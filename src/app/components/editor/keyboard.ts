import { isKeyHotkey } from 'is-hotkey';
import { KeyboardEvent } from 'react';
import { Editor } from 'slate';
import { isAnyMarkActive, isBlockActive, removeAllMark, toggleBlock, toggleMark } from './utils';
import { BlockType, MarkType } from './types';

export const INLINE_HOTKEYS: Record<string, MarkType> = {
  'mod+b': MarkType.Bold,
  'mod+i': MarkType.Italic,
  'mod+u': MarkType.Underline,
  'mod+shift+u': MarkType.StrikeThrough,
  'mod+[': MarkType.Code,
  'mod+h': MarkType.Spoiler,
};
const INLINE_KEYS = Object.keys(INLINE_HOTKEYS);

export const BLOCK_HOTKEYS: Record<string, BlockType> = {
  'mod+7': BlockType.OrderedList,
  'mod+8': BlockType.UnorderedList,
  "mod+'": BlockType.BlockQuote,
  'mod+;': BlockType.CodeBlock,
};
const BLOCK_KEYS = Object.keys(BLOCK_HOTKEYS);

/**
 * @return boolean true if shortcut is toggled.
 */
export const toggleKeyboardShortcut = (editor: Editor, event: KeyboardEvent<Element>): boolean => {
  if (isKeyHotkey('mod+e', event)) {
    if (isAnyMarkActive(editor)) {
      removeAllMark(editor);
      return true;
    }

    if (!isBlockActive(editor, BlockType.Paragraph)) {
      toggleBlock(editor, BlockType.Paragraph);
      return true;
    }
    return false;
  }

  const blockToggled = BLOCK_KEYS.find((hotkey) => {
    if (isKeyHotkey(hotkey, event)) {
      event.preventDefault();
      toggleBlock(editor, BLOCK_HOTKEYS[hotkey]);
      return true;
    }
    return false;
  });
  if (blockToggled) return true;

  const inlineToggled = isBlockActive(editor, BlockType.CodeBlock)
    ? false
    : INLINE_KEYS.find((hotkey) => {
        if (isKeyHotkey(hotkey, event)) {
          event.preventDefault();
          toggleMark(editor, INLINE_HOTKEYS[hotkey]);
          return true;
        }
        return false;
      });
  return !!inlineToggled;
};
