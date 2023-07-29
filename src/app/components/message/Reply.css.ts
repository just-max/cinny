import { style } from '@vanilla-extract/css';
import { config, toRem } from 'folds';

export const Reply = style({
  padding: `0 ${config.space.S100}`,
  marginBottom: toRem(1),
  cursor: 'pointer',
  minWidth: 0,
  maxWidth: '100%',
});

export const ReplyContent = style({
  opacity: config.opacity.P300,

  selectors: {
    [`${Reply} &:hover`]: {
      opacity: config.opacity.P500,
    },
  },
});
