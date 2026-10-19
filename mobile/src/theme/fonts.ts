import {
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
} from '@expo-google-fonts/nunito';
import { Ionicons } from '@expo/vector-icons';

/** Every font the app needs before the splash screen hides. */
export const appFonts = {
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
  ...Ionicons.font,
};
