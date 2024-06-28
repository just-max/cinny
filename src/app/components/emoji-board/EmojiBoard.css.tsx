import { style } from '@vanilla-extract/css';
import { DefaultReset, FocusOutline, color, config, toRem } from 'folds';

// pre-define some dimensions so we can refer to them to size virtualized components
export const styleParams = {
  emojiItemHeight: 48,
  emojiItemWidth: 48,
  stickerItemHeight: 112,
  stickerItemWidth: 112,

  // this is hard-coded based on the size of an emoji group label and padding,
  // since it cannot be read directly from `config`
  groupExtraHeight: 56,
};

Object.freeze(styleParams);

export const Base = style({
  maxWidth: toRem(432),
  width: `calc(100vw - 2 * ${config.space.S400})`,
  height: toRem(450),
  backgroundColor: color.Surface.Container,
  color: color.Surface.OnContainer,
  border: `${config.borderWidth.B300} solid ${color.Surface.ContainerLine}`,
  borderRadius: config.radii.R400,
  boxShadow: config.shadow.E200,
  overflow: 'hidden',
});

export const Sidebar = style({
  width: toRem(54),
  backgroundColor: color.Surface.Container,
  color: color.Surface.OnContainer,
  position: 'relative',
});

export const SidebarContent = style({
  padding: `${config.space.S200} 0`,
});

export const SidebarStack = style({
  width: '100%',
  backgroundColor: color.Surface.Container,
});

export const NativeEmojiSidebarStack = style({
  position: 'sticky',
  bottom: '-67%',
  zIndex: 1,
});

export const SidebarDivider = style({
  width: toRem(18),
});

export const Header = style({
  padding: config.space.S300,
  paddingBottom: 0,
});

export const EmojiBoardTab = style({
  cursor: 'pointer',
});

export const Footer = style({
  padding: config.space.S200,
  margin: config.space.S300,
  marginTop: 0,
  minHeight: toRem(40),

  borderRadius: config.radii.R400,
  backgroundColor: color.SurfaceVariant.Container,
  color: color.SurfaceVariant.OnContainer,
});

export const EmojiGroup = style({
  padding: `${config.space.S300} 0`,
});

export const EmojiGroupLabel = style({
  position: 'sticky',
  top: config.space.S200,
  zIndex: 1,

  margin: 'auto',
  padding: `${config.space.S100} ${config.space.S200}`,
  borderRadius: config.radii.Pill,
  backgroundColor: color.SurfaceVariant.Container,
  color: color.SurfaceVariant.OnContainer,
});

export const EmojiGroupContent = style([
  DefaultReset,
  {
    padding: `0 ${config.space.S200}`,
  },
]);

export const EmojiPreview = style([
  DefaultReset,
  {
    width: toRem(32),
    height: toRem(32),
    fontSize: toRem(32),
    lineHeight: toRem(32),
  },
]);

export const EmojiItem = style([
  DefaultReset,
  FocusOutline,
  {
    width: toRem(styleParams.emojiItemWidth),
    height: toRem(styleParams.emojiItemHeight),
    fontSize: toRem(32),
    lineHeight: toRem(32),
    borderRadius: config.radii.R400,
    cursor: 'pointer',

    ':hover': {
      backgroundColor: color.Surface.ContainerHover,
    },
  },
]);

export const StickerItem = style([
  EmojiItem,
  {
    width: toRem(styleParams.stickerItemWidth),
    height: toRem(styleParams.stickerItemHeight),
  },
]);

export const CustomEmojiImg = style([
  DefaultReset,
  {
    width: toRem(32),
    height: toRem(32),
    objectFit: 'contain',
  },
]);

export const StickerImg = style([
  DefaultReset,
  {
    width: toRem(96),
    height: toRem(96),
    objectFit: 'contain',
  },
]);
