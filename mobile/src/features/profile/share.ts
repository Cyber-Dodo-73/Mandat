import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import type { ComponentRef, RefObject } from 'react';
import { Share, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { friendLink } from '@/features/social/friendCode';

/** Copies the friend code; returns false when the clipboard refused. */
export async function copyFriendCode(code: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(code);
    return true;
  } catch {
    return false;
  }
}

/** Shares the deep link that opens the app on "add this friend". */
export async function shareFriendLink(code: string, message: string): Promise<void> {
  await Share.share({ message: `${message}\n${friendLink(code)}` });
}

/** Renders the given view (profile card + showcase) to a PNG and opens the share sheet. */
export async function shareProfileImage(
  view: RefObject<ComponentRef<typeof View> | null>,
  dialogTitle: string,
): Promise<void> {
  if (!view.current) return;
  const uri = await captureRef(view, { format: 'png', quality: 1, result: 'tmpfile' });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle, UTI: 'public.png' });
  } else {
    await Share.share({ url: uri });
  }
}
