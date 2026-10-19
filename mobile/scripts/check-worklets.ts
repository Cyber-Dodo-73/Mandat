/**
 * Static guard for UI-thread crashes that Jest cannot see (Jest runs every worklet on the JS thread).
 *
 * Finds the callbacks the Worklets Babel plugin moves to the UI thread (useAnimatedStyle,
 * useDerivedValue, gesture callbacks, withTiming callbacks, scheduleOnUI bodies, functions with a
 * 'worklet' directive...) and checks every function they call synchronously. A call is fine when
 * the callee is defined inside the worklet itself, carries a 'worklet' directive, or comes from
 * the JS builtins or a worklet-aware library (Reanimated, Worklets, Skia, Gesture Handler).
 * Anything else (theme or lib helpers, component closures, i18n `t`, haptics, router, setState)
 * must go through scheduleOnRN, or Reanimated aborts the release app with
 * "Tried to synchronously call a non-worklet function on the UI thread".
 *
 * Best effort: calls whose target the type checker cannot resolve are skipped.
 */
import { dirname, join, relative, sep } from 'node:path';

import ts from 'typescript';

const ROOT = join(__dirname, '..');
const SCANNED_DIRS = ['src', 'app'].map((dir) => join(ROOT, dir) + sep);

/** Mirrors react-native-worklets/plugin (autoworkletization): hook name → workletized argument indices. */
const FUNCTION_HOOKS = new Map<string, number[]>([
  ['useFrameCallback', [0]],
  ['useAnimatedStyle', [0]],
  ['useAnimatedProps', [0]],
  ['createAnimatedPropAdapter', [0]],
  ['useDerivedValue', [0]],
  ['useAnimatedReaction', [0, 1]],
  ['withTiming', [2, 3]],
  ['withSpring', [2, 3]],
  ['withDecay', [1]],
  ['withRepeat', [3]],
  ['runOnUI', [0]],
  ['executeOnUIRuntimeSync', [0]],
  ['scheduleOnUI', [0]],
  ['runOnUISync', [0]],
  ['runOnUIAsync', [0]],
  ['runOnRuntime', [1]],
  ['runOnRuntimeSync', [1]],
  ['runOnRuntimeAsync', [1]],
  ['scheduleOnRuntime', [1]],
]);
/** Hooks taking a config object whose function properties all run on the UI thread. */
const OBJECT_HOOKS = new Set([
  'useAnimatedScrollHandler',
  'useTapGesture',
  'usePanGesture',
  'usePinchGesture',
  'useRotationGesture',
  'useFlingGesture',
  'useLongPressGesture',
  'useNativeGesture',
  'useManualGesture',
  'useHoverGesture',
]);
const GESTURE_OBJECTS = new Set([
  'Tap', 'Pan', 'Pinch', 'Rotation', 'Fling', 'LongPress', 'ForceTouch', 'Native', 'Manual', 'Race', 'Simultaneous', 'Exclusive', 'Hover',
]);
const GESTURE_CALLBACKS = new Set([
  'onBegin', 'onStart', 'onEnd', 'onFinalize', 'onUpdate', 'onChange', 'onTouchesDown', 'onTouchesMove', 'onTouchesUp', 'onTouchesCancelled',
]);
/** Their function arguments are sent back to the JS thread, not called on the UI thread. */
const TO_JS = new Set(['scheduleOnRN', 'runOnJS']);
/** Packages whose APIs are safe to call from worklets (worklets themselves or JSI host objects). */
const WORKLET_PACKAGES = ['react-native-reanimated', 'react-native-worklets', '@shopify/react-native-skia', 'react-native-gesture-handler'];

type Finding = { file: string; line: number; column: number; message: string };

const configPath = join(ROOT, 'tsconfig.json');
const config = ts.readConfigFile(configPath, (path) => ts.sys.readFile(path));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(configPath));
const program = ts.createProgram(parsed.fileNames, parsed.options);
const checker = program.getTypeChecker();

const inProject = (fileName: string) =>
  SCANNED_DIRS.some((dir) => fileName.startsWith(dir)) && !/(__tests__|\.test\.tsx?$|\.d\.ts$)/.test(fileName);

const isFunctionLike = (node: ts.Node): node is ts.FunctionLikeDeclaration =>
  ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node);

function hasWorkletDirective(fn: ts.FunctionLikeDeclaration): boolean {
  const body = fn.body;
  if (!body || !ts.isBlock(body)) return false;
  for (const statement of body.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) return false;
    if (statement.expression.text === 'worklet') return true;
  }
  return false;
}

const calleeName = (expression: ts.Expression): string | undefined =>
  ts.isIdentifier(expression) ? expression.text : ts.isPropertyAccessExpression(expression) ? expression.name.text : undefined;

/** `Gesture.Pan()...` chain, like the plugin's containsGestureObject. */
function containsGestureObject(expression: ts.Expression): boolean {
  if (!ts.isCallExpression(expression) || !ts.isPropertyAccessExpression(expression.expression)) return false;
  const { expression: target, name } = expression.expression;
  if (ts.isIdentifier(target) && target.text === 'Gesture' && GESTURE_OBJECTS.has(name.text)) return true;
  return containsGestureObject(target);
}

/** A function referenced by name (useDerivedValue(compute)) is workletized like an inline one. */
function resolveFunction(node: ts.Expression): ts.FunctionLikeDeclaration | undefined {
  if (isFunctionLike(node)) return node;
  if (!ts.isIdentifier(node)) return undefined;
  const declaration = checker.getSymbolAtLocation(node)?.valueDeclaration;
  if (!declaration || !inProject(declaration.getSourceFile().fileName)) return undefined;
  if (isFunctionLike(declaration)) return declaration;
  if (ts.isVariableDeclaration(declaration) && declaration.initializer && isFunctionLike(declaration.initializer)) return declaration.initializer;
  return undefined;
}

function collectRoots(file: ts.SourceFile): Map<ts.FunctionLikeDeclaration, string> {
  const roots = new Map<ts.FunctionLikeDeclaration, string>();
  const add = (node: ts.Expression | undefined, label: string) => {
    const fn = node && resolveFunction(node);
    if (fn && !roots.has(fn)) roots.set(fn, label);
  };
  const visit = (node: ts.Node) => {
    if (isFunctionLike(node) && hasWorkletDirective(node)) roots.set(node, "'worklet' function");
    if (ts.isCallExpression(node)) {
      const name = calleeName(node.expression);
      if (name && FUNCTION_HOOKS.has(name)) {
        for (const index of FUNCTION_HOOKS.get(name) ?? []) add(node.arguments[index], name);
      }
      const config = node.arguments[0];
      if (name && OBJECT_HOOKS.has(name) && config && ts.isObjectLiteralExpression(config)) {
        for (const property of config.properties) {
          if (ts.isMethodDeclaration(property)) roots.set(property, `${name}.${property.name.getText()}`);
          else if (ts.isPropertyAssignment(property)) add(property.initializer, `${name}.${property.name.getText()}`);
        }
      }
      if (
        name &&
        GESTURE_CALLBACKS.has(name) &&
        ts.isPropertyAccessExpression(node.expression) &&
        containsGestureObject(node.expression.expression)
      ) {
        add(node.arguments[0], `Gesture.${name}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return roots;
}

const contains = (outer: ts.Node, inner: ts.Node) =>
  inner.getSourceFile() === outer.getSourceFile() && inner.pos >= outer.pos && inner.end <= outer.end;

function packageOf(fileName: string): string | undefined {
  const match = /node_modules[\\/]((?:@[^\\/]+[\\/])?[^\\/]+)/.exec(fileName);
  return match?.[1]?.replace(/\\/g, '/');
}

const describe = (node: ts.Node) => {
  const file = node.getSourceFile();
  const { line } = file.getLineAndCharacterOfPosition(node.getStart());
  return `${relative(ROOT, file.fileName)}:${line + 1}`;
};

/** Declaration of what a call runs, or undefined when it cannot be resolved. */
function calleeDeclaration(call: ts.CallExpression): ts.Declaration | undefined {
  const signature = checker.getResolvedSignature(call);
  if (signature?.declaration && !ts.isJSDocSignature(signature.declaration)) return signature.declaration;
  let symbol = checker.getSymbolAtLocation(ts.isPropertyAccessExpression(call.expression) ? call.expression.name : call.expression);
  if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
  return symbol?.valueDeclaration ?? symbol?.declarations?.[0];
}

/** Why calling this declaration from a worklet is unsafe, or null when it is fine. */
function unsafeCallee(declaration: ts.Declaration): string | null {
  const fileName = declaration.getSourceFile().fileName;
  const pkg = packageOf(fileName);
  if (pkg === 'typescript' || /[\\/]typescript[\\/]lib[\\/]lib\.[^\\/]*\.d\.ts$/.test(fileName)) return null;
  if (pkg) return WORKLET_PACKAGES.includes(pkg) ? null : `comes from '${pkg}', which does not run on the UI thread`;
  if (!inProject(fileName)) return null;
  let fn: ts.Node = declaration;
  if (ts.isVariableDeclaration(fn) || ts.isPropertyAssignment(fn)) fn = fn.initializer ?? fn;
  if (isFunctionLike(fn)) return hasWorkletDirective(fn) ? null : `is not a worklet (declared at ${describe(fn)})`;
  // Only a type is known (a prop, a callback parameter): nothing proves the value is a worklet.
  return `is a function-typed value (${describe(declaration)}) that may not be a worklet`;
}

function checkRoot(root: ts.FunctionLikeDeclaration, label: string, findings: Finding[]) {
  const file = root.getSourceFile();
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const name = calleeName(node.expression);
      if (name && TO_JS.has(name)) {
        // The function is sent to JS; only its arguments are evaluated here.
        const [target, ...args] = node.arguments;
        if (target && (ts.isArrowFunction(target) || ts.isFunctionExpression(target))) {
          report(node, `${name} gets an inline function, which would be created on the UI thread: pass a function defined on the JS side`);
        }
        args.forEach(visit);
        return;
      }
      const declaration = calleeDeclaration(node);
      if (declaration && !contains(root, declaration)) {
        const reason = unsafeCallee(declaration);
        if (reason) report(node, `\`${node.expression.getText()}(…)\` ${reason}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  const report = (node: ts.Node, message: string) => {
    const { line, character } = file.getLineAndCharacterOfPosition(node.getStart());
    findings.push({ file: relative(ROOT, file.fileName), line: line + 1, column: character + 1, message: `in ${label}: ${message}` });
  };
  if (root.body) visit(root.body);
}

const findings: Finding[] = [];
let rootCount = 0;
for (const file of program.getSourceFiles()) {
  if (!inProject(file.fileName)) continue;
  const roots = collectRoots(file);
  rootCount += roots.size;
  for (const [root, label] of roots) checkRoot(root, label, findings);
}

const unique = [...new Map(findings.map((finding) => [`${finding.file}:${finding.line}:${finding.column}:${finding.message}`, finding])).values()];
for (const { file, line, column, message } of unique) console.error(`${file}:${line}:${column} ${message}`);
if (unique.length > 0) {
  console.error(`\n${unique.length} UI-thread call(s) to non-worklet functions. Add 'worklet' to pure helpers or wrap the call in scheduleOnRN.`);
  process.exit(1);
}
console.log(`Worklets OK: ${rootCount} UI-thread callbacks only call worklets.`);
