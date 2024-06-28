import React, {
  ChangeEventHandler,
  FocusEventHandler,
  MouseEventHandler,
  UIEventHandler,
  ReactNode,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef, useState
} from 'react';
import {
  Badge,
  Box,
  Chip,
  Icon,
  IconButton,
  Icons,
  Input,
  Line,
  Scroll,
  Text,
  Tooltip,
  TooltipProvider,
  as,
  config,
  toRem,
} from 'folds';
import FocusTrap from 'focus-trap-react';
import { isKeyHotkey } from 'is-hotkey';
import classNames from 'classnames';
import { MatrixClient, Room } from 'matrix-js-sdk';
import { defaultRangeExtractor, useVirtualizer, Range } from '@tanstack/react-virtual';

import * as css from './EmojiBoard.css';
import { IEmoji, IEmojiGroup, emojiGroups, emojis } from '../../plugins/emoji';
import { IEmojiGroupLabels, useEmojiGroupLabels } from './useEmojiGroupLabels';
import { IEmojiGroupIcons, useEmojiGroupIcons } from './useEmojiGroupIcons';
import { preventScrollWithArrowKey } from '../../utils/keyboard';
import { useRelevantImagePacks } from '../../hooks/useImagePacks';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useRecentEmoji } from '../../hooks/useRecentEmoji';
import { ExtendedPackImage, ImagePack, PackUsage } from '../../plugins/custom-emoji';
import { isUserId } from '../../utils/matrix';
import { editableActiveElement, targetFromEvent } from '../../utils/dom';
import { useAsyncSearch, UseAsyncSearchOptions, UseAsyncSearchResult } from '../../hooks/useAsyncSearch';
import { useDebounce } from '../../hooks/useDebounce';
import { useThrottle } from '../../hooks/useThrottle';
import { addRecentEmoji } from '../../plugins/recent-emoji';
import { mobileOrTablet } from '../../utils/user-agent';
import { VirtualTile } from '../virtualizer';

export enum EmojiBoardTab {
  Emoji = 'Emoji',
  Sticker = 'Sticker',
}

enum EmojiType {
  Emoji = 'emoji',
  CustomEmoji = 'customEmoji',
  Sticker = 'sticker',
}

export type EmojiItemInfo = {
  type: EmojiType;
  data: string;
  shortcode: string;
  label: string;
};

const getDOMGroupId = (id: string): string => `EmojiBoardGroup-${id}`;

const getEmojiItemInfo = (element: Element): EmojiItemInfo | undefined => {
  const type = element.getAttribute('data-emoji-type') as EmojiType | undefined;
  const data = element.getAttribute('data-emoji-data');
  const label = element.getAttribute('title');
  const shortcode = element.getAttribute('data-emoji-shortcode');

  if (type && data && shortcode && label)
    return {
      type,
      data,
      shortcode,
      label,
    };
  return undefined;
};

function Sidebar({ children }: { children: ReactNode }) {
  return (
    <Box className={css.Sidebar} shrink="No">
      <Scroll size="0">
        <Box className={css.SidebarContent} direction="Column" alignItems="Center" gap="100">
          {children}
        </Box>
      </Scroll>
    </Box>
  );
}

const SidebarStack = as<'div'>(({ className, children, ...props }, ref) => (
  <Box
    className={classNames(css.SidebarStack, className)}
    direction="Column"
    alignItems="Center"
    gap="100"
    {...props}
    ref={ref}
  >
    {children}
  </Box>
));
function SidebarDivider() {
  return <Line className={css.SidebarDivider} size="300" variant="Surface" />;
}

function Header({ children }: { children: ReactNode }) {
  return (
    <Box className={css.Header} direction="Column" shrink="No">
      {children}
    </Box>
  );
}

function Content({ children }: { children: ReactNode }) {
  return <Box grow="Yes">{children}</Box>;
}

function Footer({ children }: { children: ReactNode }) {
  return (
    <Box shrink="No" className={css.Footer} gap="300" alignItems="Center">
      {children}
    </Box>
  );
}

const EmojiBoardLayout = as<
  'div',
  {
    header: ReactNode;
    sidebar?: ReactNode;
    footer?: ReactNode;
    children: ReactNode;
  }
>(({ className, header, sidebar, footer, children, ...props }, ref) => (
  <Box
    display="InlineFlex"
    className={classNames(css.Base, className)}
    direction="Row"
    {...props}
    ref={ref}
  >
    <Box direction="Column" grow="Yes">
      {header}
      {children}
      {footer}
    </Box>
    <Line size="300" direction="Vertical" />
    {sidebar}
  </Box>
));

function EmojiBoardTabs({
  tab,
  onTabChange,
}: {
  tab: EmojiBoardTab;
  onTabChange: (tab: EmojiBoardTab) => void;
}) {
  return (
    <Box gap="100">
      <Badge
        className={css.EmojiBoardTab}
        as="button"
        variant="Secondary"
        fill={tab === EmojiBoardTab.Sticker ? 'Solid' : 'None'}
        size="500"
        onClick={() => onTabChange(EmojiBoardTab.Sticker)}
      >
        <Text as="span" size="L400">
          Sticker
        </Text>
      </Badge>
      <Badge
        className={css.EmojiBoardTab}
        as="button"
        variant="Secondary"
        fill={tab === EmojiBoardTab.Emoji ? 'Solid' : 'None'}
        size="500"
        onClick={() => onTabChange(EmojiBoardTab.Emoji)}
      >
        <Text as="span" size="L400">
          Emoji
        </Text>
      </Badge>
    </Box>
  );
}

function SidebarBtn<T extends string>({
  active,
  label,
  id,
  onItemClick,
  children,
}: {
  active?: boolean;
  label: string;
  id: T;
  onItemClick: (id: T) => void;
  children: ReactNode;
}) {
  return (
    <TooltipProvider
      delay={500}
      position="Left"
      tooltip={
        <Tooltip id={`SidebarStackItem-${id}-label`}>
          <Text size="T300">{label}</Text>
        </Tooltip>
      }
    >
      {(ref) => (
        <IconButton
          aria-pressed={active}
          aria-labelledby={`SidebarStackItem-${id}-label`}
          ref={ref}
          onClick={() => onItemClick(id)}
          size="400"
          radii="300"
          variant="Surface"
        >
          {children}
        </IconButton>
      )}
    </TooltipProvider>
  );
}

const EmojiGroup = as<
  'div',
  {
    id: string;
    label: string;
    children: ReactNode;
  }
>(({ className, id, label, children, ...props }, ref) => (
  <Box
    id={getDOMGroupId(id)}
    data-group-id={id}
    className={classNames(css.EmojiGroup, className)}
    direction="Column"
    gap="200"
    {...props}
    ref={ref}
  >
    <Text id={`EmojiGroup-${id}-label`} as="label" className={css.EmojiGroupLabel} size="O400">
      {label}
    </Text>
    <div aria-labelledby={`EmojiGroup-${id}-label`} className={css.EmojiGroupContent}>
      <Box wrap="Wrap" justifyContent="Center">
        {children}
      </Box>
    </div>
  </Box>
));

function EmojiItem({
  label,
  type,
  data,
  shortcode,
  children,
}: {
  label: string;
  type: EmojiType;
  data: string;
  shortcode: string;
  children: ReactNode;
}) {
  return (
    <Box
      as="button"
      className={css.EmojiItem}
      type="button"
      alignItems="Center"
      justifyContent="Center"
      title={label}
      aria-label={`${label} emoji`}
      data-emoji-type={type}
      data-emoji-data={data}
      data-emoji-shortcode={shortcode}
    >
      {children}
    </Box>
  );
}

function StickerItem({
  label,
  type,
  data,
  shortcode,
  children,
}: {
  label: string;
  type: EmojiType;
  data: string;
  shortcode: string;
  children: ReactNode;
}) {
  return (
    <Box
      as="button"
      className={css.StickerItem}
      type="button"
      alignItems="Center"
      justifyContent="Center"
      title={label}
      aria-label={`${label} sticker`}
      data-emoji-type={type}
      data-emoji-data={data}
      data-emoji-shortcode={shortcode}
    >
      {children}
    </Box>
  );
}

// TODO: move to own file

interface VirtualizedItem<T> { key: () => string, size: () => number, item: T }

const virtualizedItemVirtualizerOptions = <T,>(items: VirtualizedItem<T>[]) => ({
  estimateSize: (i: number) => items[i].size(),
  getItemKey: (i: number) => items[i].key(),
});

interface SearchResultItem { kind: "search", result: UseAsyncSearchResult<ExtendedPackImage | IEmoji> }
interface RecentItem { kind: "recent" }
interface CustomPackItem { kind: "custom", pack: ImagePack }
interface StickerPackItem { kind: "sticker", pack: ImagePack }
interface NativeGroupItem { kind: "native", emojiGroup: IEmojiGroup }
type EmojiBoardItem = SearchResultItem | RecentItem | CustomPackItem | StickerPackItem | NativeGroupItem

function emojiBoardItemId(item: EmojiBoardItem) {
  switch (item.kind) {
    case "search": return "search";
    case "recent": return "recent";
    case "custom": return `custom-${item.pack.id}`;
    case "sticker": return `sticker-${item.pack.id}`;
    case "native": return `native-${item.emojiGroup.id}`;
    default:
  }
  return item; // unreachable (item has type never)
}

// TODO: memo?
function RecentEmojiSidebarStack({ activeId, onItemClick }: { activeId: string, onItemClick: (id: string) => void }) {
  const recentId = emojiBoardItemId({ kind: "recent" });
  return (
    <SidebarStack>
      <SidebarBtn
        active={activeId === recentId}
        id={recentId}
        label="Recent"
        onItemClick={() => onItemClick(recentId)}
      >
        <Icon src={Icons.RecentClock} filled={activeId === recentId} />
      </SidebarBtn>
    </SidebarStack>
  );
}

// TODO: memo?
function ImagePackSidebarStack({
  mx,
  packs,
  activeId,
  usage,
  onItemClick,
}: {
  mx: MatrixClient;
  packs: ImagePack[];
  activeId: string;
  usage: PackUsage;
  onItemClick: (id: string) => void;
}) {
  // const activeGroupId = useAtomValue(activeGroupIdAtom);
  return (
    <SidebarStack>
      {usage === PackUsage.Emoticon && <SidebarDivider />}
      {packs.map((pack) => {
        let label = pack.displayName;
        if (!label) label = isUserId(pack.id) ? 'Personal Pack' : mx.getRoom(pack.id)?.name;
        const packItemId = emojiBoardItemId({
          kind: (usage === PackUsage.Emoticon ? "custom" : "sticker"),
          pack,
        });
        return (
          <SidebarBtn
            active={activeId === packItemId}
            key={packItemId}
            id={packItemId}
            label={label || 'Unknown Pack'}
            onItemClick={onItemClick}
          >
            <img
              style={{
                width: toRem(24),
                height: toRem(24),
                objectFit: 'contain',
              }}
              src={mx.mxcUrlToHttp(pack.getPackAvatarUrl(usage) ?? '') || pack.avatarUrl}
              alt={label || 'Unknown Pack'}
            />
          </SidebarBtn>
        );
      })}
    </SidebarStack>
  );
}

// TODO: memo?
function NativeEmojiSidebarStack({
  groups,
  icons,
  activeId,
  labels,
  onItemClick,
}: {
  groups: IEmojiGroup[];
  icons: IEmojiGroupIcons;
  activeId: string;
  labels: IEmojiGroupLabels;
  onItemClick: (id: string) => void;
}) {
  return (
    <SidebarStack className={css.NativeEmojiSidebarStack}>
      <SidebarDivider />
      {groups.map((group) => {
        const groupItemId = emojiBoardItemId({ kind: "native", emojiGroup: group });
        return (
          <SidebarBtn
            key={groupItemId}
            active={activeId === groupItemId}
            id={groupItemId}
            label={labels[group.id]}
            onItemClick={onItemClick}
          >
            <Icon src={icons[group.id]} filled={activeId === groupItemId} />
          </SidebarBtn>
        );
      })}
    </SidebarStack>
  );
}

// TODO: memo?
export function RecentEmojiGroup({
  label,
  id,
  emojis: recentEmojis,
}: {
  label: string;
  id: string;
  emojis: IEmoji[];
}) {
  return (
    <EmojiGroup key={id} id={id} label={label}>
      {recentEmojis.map((emoji) => (
        <EmojiItem
          key={emoji.unicode}
          label={emoji.label}
          type={EmojiType.Emoji}
          data={emoji.unicode}
          shortcode={emoji.shortcode}
        >
          {emoji.unicode}
        </EmojiItem>
      ))}
    </EmojiGroup>
  );
}

// TODO: memo?
function SearchEmojiGroup({
  mx,
  tab,
  label,
  id,
  emojis: searchResult,
}: {
  mx: MatrixClient;
  tab: EmojiBoardTab;
  label: string;
  id: string;
  emojis: Array<ExtendedPackImage | IEmoji>;
}) {
  return (
    <EmojiGroup key={id} id={id} label={label}>
      {tab === EmojiBoardTab.Emoji
        ? searchResult.map((emoji) =>
            'unicode' in emoji ? (
              <EmojiItem
                key={emoji.unicode}
                label={emoji.label}
                type={EmojiType.Emoji}
                data={emoji.unicode}
                shortcode={emoji.shortcode}
              >
                {emoji.unicode}
              </EmojiItem>
            ) : (
              <EmojiItem
                key={emoji.shortcode}
                label={emoji.body || emoji.shortcode}
                type={EmojiType.CustomEmoji}
                data={emoji.url}
                shortcode={emoji.shortcode}
              >
                <img
                  loading="lazy"
                  className={css.CustomEmojiImg}
                  alt={emoji.body || emoji.shortcode}
                  src={mx.mxcUrlToHttp(emoji.url) ?? emoji.url}
                />
              </EmojiItem>
            )
          )
        : searchResult.map((emoji) =>
            'unicode' in emoji ? null : (
              <StickerItem
                key={emoji.shortcode}
                label={emoji.body || emoji.shortcode}
                type={EmojiType.Sticker}
                data={emoji.url}
                shortcode={emoji.shortcode}
              >
                <img
                  loading="lazy"
                  className={css.StickerImg}
                  alt={emoji.body || emoji.shortcode}
                  src={mx.mxcUrlToHttp(emoji.url) ?? emoji.url}
                />
              </StickerItem>
            )
          )}
    </EmojiGroup>
  );
}

const CustomEmojiGroup = memo(
  ({ mx, pack }: { mx: MatrixClient; pack: ImagePack }) =>
    <EmojiGroup key={pack.id} id={pack.id} label={pack.displayName || 'Unknown'}>
      {pack.getEmojis().map((image) => (
        <EmojiItem
          key={image.shortcode}
          label={image.body || image.shortcode}
          type={EmojiType.CustomEmoji}
          data={image.url}
          shortcode={image.shortcode}
        >
          <img
            /* TODO: ??? lazy loading is instead provided by virtualized scrolling,
            * while using 'eager' here pre-fetches images before they scroll into view */
            loading="lazy"
            className={css.CustomEmojiImg}
            alt={image.body || image.shortcode}
            src={mx.mxcUrlToHttp(image.url) ?? image.url}
          />
        </EmojiItem>
      ))}
    </EmojiGroup>
);

const StickerGroup = memo(
  ({ mx, pack }: { mx: MatrixClient, pack: ImagePack }) =>
    <EmojiGroup key={pack.id} id={pack.id} label={pack.displayName || 'Unknown'}>
      {pack.getStickers().map((image) => (
        <StickerItem
          key={image.shortcode}
          label={image.body || image.shortcode}
          type={EmojiType.Sticker}
          data={image.url}
          shortcode={image.shortcode}
        >
          <img
            loading="lazy"
            className={css.StickerImg}
            alt={image.body || image.shortcode}
            src={mx.mxcUrlToHttp(image.url) ?? image.url}
          />
        </StickerItem>
      ))}
    </EmojiGroup>
);

const NoStickers = memo(
  () =>
    <Box
      style={{ padding: `${toRem(60)} ${config.space.S500}` }}
      alignItems="Center"
      justifyContent="Center"
      direction="Column"
      gap="300"
    >
      <Icon size="600" src={Icons.Sticker} />
      <Box direction="Inherit">
        <Text align="Center">No Sticker Packs!</Text>
        <Text priority="300" align="Center" size="T200">
          Add stickers from user, room or space settings.
        </Text>
      </Box>
    </Box>
);

const NativeEmojiGroup = memo(
  ({ emojiGroup, emojiGroupLabel }: { emojiGroup: IEmojiGroup; emojiGroupLabel: string }) =>
    <EmojiGroup key={emojiGroup.id} id={emojiGroup.id} label={emojiGroupLabel}>
      {emojiGroup.emojis.map((emoji) => (
        <EmojiItem
          key={emoji.unicode}
          label={emoji.label}
          type={EmojiType.Emoji}
          data={emoji.unicode}
          shortcode={emoji.shortcode}
        >
          {emoji.unicode}
        </EmojiItem>
      ))}
    </EmojiGroup>
);

const getSearchListItemStr = (item: ExtendedPackImage | IEmoji) => {
  const shortcode = `:${item.shortcode}:`;
  if ('body' in item) {
    return [shortcode, item.body ?? ''];
  }
  return shortcode;
};
const SEARCH_OPTIONS: UseAsyncSearchOptions = {
  limit: 26,
  matchOptions: {
    contain: true,
  },
};

export function EmojiBoard({
  tab = EmojiBoardTab.Emoji,
  onTabChange,
  imagePackRooms,
  requestClose,
  returnFocusOnDeactivate,
  onEmojiSelect,
  onCustomEmojiSelect,
  onStickerSelect,
  allowTextCustomEmoji,
}: {
  tab?: EmojiBoardTab;
  onTabChange?: (tab: EmojiBoardTab) => void;
  imagePackRooms: Room[];
  requestClose: () => void;
  returnFocusOnDeactivate?: boolean;
  onEmojiSelect?: (unicode: string, shortcode: string) => void;
  onCustomEmojiSelect?: (mxc: string, shortcode: string) => void;
  onStickerSelect?: (mxc: string, shortcode: string, label: string) => void;
  allowTextCustomEmoji?: boolean;
}) {
  const start = Date.now();

  const emojiTab = tab === EmojiBoardTab.Emoji;
  const stickerTab = tab === EmojiBoardTab.Sticker;
  const usage = emojiTab ? PackUsage.Emoticon : PackUsage.Sticker;

  const mx = useMatrixClient();
  const emojiGroupLabels = useEmojiGroupLabels();
  const emojiGroupIcons = useEmojiGroupIcons();
  const imagePacks = useRelevantImagePacks(mx, usage, imagePackRooms);
  const recentEmojis = useRecentEmoji(mx, 21);

  const contentScrollRef = useRef<HTMLDivElement>(null);
  const emojiPreviewRef = useRef<HTMLDivElement>(null);
  const emojiPreviewTextRef = useRef<HTMLParagraphElement>(null);

  const searchList = useMemo(() => {
    let list: Array<ExtendedPackImage | IEmoji> = [];
    list = list.concat(imagePacks.flatMap((pack) => pack.getImagesFor(usage)));
    if (emojiTab) list = list.concat(emojis);
    return list;
  }, [emojiTab, usage, imagePacks]);

  const [result, search, resetSearch] = useAsyncSearch(
    searchList,
    getSearchListItemStr,
    SEARCH_OPTIONS
  );

  const handleOnChange: ChangeEventHandler<HTMLInputElement> = useDebounce(
    useCallback(
      (evt) => {
        const term = evt.target.value;
        if (term) search(term);
        else resetSearch();
      },
      [search, resetSearch]
    ),
    { wait: 200 }
  );

  const handleEmojiClick: MouseEventHandler = (evt) => {
    const targetEl = targetFromEvent(evt.nativeEvent, 'button');
    if (!targetEl) return;
    const emojiInfo = getEmojiItemInfo(targetEl);
    if (!emojiInfo) return;
    if (emojiInfo.type === EmojiType.Emoji) {
      onEmojiSelect?.(emojiInfo.data, emojiInfo.shortcode);
      if (!evt.altKey && !evt.shiftKey) {
        addRecentEmoji(mx, emojiInfo.data);
        requestClose();
      }
    }
    if (emojiInfo.type === EmojiType.CustomEmoji) {
      onCustomEmojiSelect?.(emojiInfo.data, emojiInfo.shortcode);
      if (!evt.altKey && !evt.shiftKey) requestClose();
    }
    if (emojiInfo.type === EmojiType.Sticker) {
      onStickerSelect?.(emojiInfo.data, emojiInfo.shortcode, emojiInfo.label);
      if (!evt.altKey && !evt.shiftKey) requestClose();
    }
  };

  const handleEmojiPreview = useCallback(
    (element: HTMLButtonElement) => {
      const emojiInfo = getEmojiItemInfo(element);
      if (!emojiInfo || !emojiPreviewTextRef.current) return;
      if (emojiInfo.type === EmojiType.Emoji && emojiPreviewRef.current) {
        emojiPreviewRef.current.textContent = emojiInfo.data;
      } else if (emojiInfo.type === EmojiType.CustomEmoji && emojiPreviewRef.current) {
        const img = document.createElement('img');
        img.className = css.CustomEmojiImg;
        img.setAttribute('src', mx.mxcUrlToHttp(emojiInfo.data) || emojiInfo.data);
        img.setAttribute('alt', emojiInfo.shortcode);
        emojiPreviewRef.current.textContent = '';
        emojiPreviewRef.current.appendChild(img);
      }
      emojiPreviewTextRef.current.textContent = `:${emojiInfo.shortcode}:`;
    },
    [mx]
  );

  const throttleEmojiHover = useThrottle(handleEmojiPreview, {
    wait: 200,
    immediate: true,
  });

  const handleEmojiHover: MouseEventHandler = (evt) => {
    const targetEl = targetFromEvent(evt.nativeEvent, 'button') as HTMLButtonElement | undefined;
    if (!targetEl) return;
    throttleEmojiHover(targetEl);
  };

  const handleEmojiFocus: FocusEventHandler = (evt) => {
    const targetEl = evt.target as HTMLButtonElement;
    handleEmojiPreview(targetEl);
  };

  const emojiGroupSize = (n: number) => 64 + 48 * Math.ceil(n / 7); // TODO: no hard-coding...
  const stickerGroupSize = (n: number) => 64 + 112 * Math.ceil(n / 3);

  const groups = useMemo(() => {
    const groupsM: VirtualizedItem<EmojiBoardItem>[] = [];
    
    const vItem = (size: () => number, item: EmojiBoardItem): VirtualizedItem<EmojiBoardItem> => ({
      size,
      key: () => emojiBoardItemId(item),
      item,
    });

    if (result)
      groupsM.push(vItem(
        () => (emojiTab ? emojiGroupSize : stickerGroupSize)(result.items.length),
        { kind: "search", result },
      ));

    if (emojiTab) {

      if (recentEmojis.length > 0)
        groupsM.push(vItem(
          () => emojiGroupSize(recentEmojis.length),
          { kind: "recent" },
        ));

      imagePacks.forEach((pack: ImagePack) => {
        groupsM.push(vItem(
          () => emojiGroupSize(pack.emoticons.length),
          { kind: "custom", pack },
        ));
      });

      emojiGroups.forEach((emojiGroup) => {
        groupsM.push(vItem(
          () => emojiGroupSize(emojiGroup.emojis.length),
          { kind: "native", emojiGroup },
        ));
      });
    }

    if (stickerTab) {
      imagePacks.forEach((pack: ImagePack) => {
        groupsM.push(vItem(
          () => stickerGroupSize(pack.stickers.length),
          { kind: "sticker", pack },
        ));
      });
    }

    return groupsM;
  }, [result, recentEmojis, emojiTab, imagePacks, stickerTab]);

  const [firstVisibleItemId, setFirstVisibleItemId] = useState<string>("");

  const itemVirtualizer = useVirtualizer({
    ...virtualizedItemVirtualizerOptions(groups),
    count: groups.length,
    getScrollElement: useCallback(() => contentScrollRef.current, []),
    overscan: 1,
    rangeExtractor: useCallback((range: Range) => {
      const k = groups[range.startIndex].key();
      if (k !== firstVisibleItemId)
        setFirstVisibleItemId(k);
      return defaultRangeExtractor(range);
    }, [groups, firstVisibleItemId, setFirstVisibleItemId]),
  });

  const handleScrollToItem = useCallback((itemId: string) => {
    const targetItemIndex = groups.findIndex(({ key }) => key() === itemId);
    itemVirtualizer.scrollToIndex(targetItemIndex, { align: "start" });
  }, [groups, itemVirtualizer]);

  // scroll to top when changing tabs
  const [prevTab, setPrevTab] = useState(tab);
  if (tab !== prevTab) {
    setPrevTab(tab);
    itemVirtualizer.scrollToOffset(0, { align: "start" });
  }

  const res = (
    <FocusTrap
      focusTrapOptions={{
        returnFocusOnDeactivate,
        initialFocus: false,
        onDeactivate: requestClose,
        clickOutsideDeactivates: true,
        allowOutsideClick: true,
        isKeyForward: (evt: KeyboardEvent) =>
          !editableActiveElement() && isKeyHotkey(['arrowdown', 'arrowright'], evt),
        isKeyBackward: (evt: KeyboardEvent) =>
          !editableActiveElement() && isKeyHotkey(['arrowup', 'arrowleft'], evt),
      }}
    >
      <EmojiBoardLayout
        header={
          <Header>
            <Box direction="Column" gap="200">
              {onTabChange && <EmojiBoardTabs tab={tab} onTabChange={onTabChange} />}
              <Input
                data-emoji-board-search
                variant="SurfaceVariant"
                size="400"
                placeholder={allowTextCustomEmoji ? 'Search or Text Reaction ' : 'Search'}
                maxLength={50}
                after={
                  allowTextCustomEmoji && result?.query ? (
                    <Chip
                      variant="Primary"
                      radii="Pill"
                      after={<Icon src={Icons.ArrowRight} size="50" />}
                      outlined
                      onClick={() => {
                        const searchInput = document.querySelector<HTMLInputElement>(
                          '[data-emoji-board-search="true"]'
                        );
                        const textReaction = searchInput?.value.trim();
                        if (!textReaction) return;
                        onCustomEmojiSelect?.(textReaction, textReaction);
                        requestClose();
                      }}
                    >
                      <Text size="L400">React</Text>
                    </Chip>
                  ) : (
                    <Icon src={Icons.Search} size="50" />
                  )
                }
                onChange={handleOnChange}
                autoFocus={!mobileOrTablet()}
              />
            </Box>
          </Header>
        }
        sidebar={
          <Sidebar>
            {emojiTab && recentEmojis.length > 0 && (
              <RecentEmojiSidebarStack activeId={firstVisibleItemId} onItemClick={handleScrollToItem} />
            )}
            {/* TODO: could be virtualized too, but perf is OK without */}
            {imagePacks.length > 0 && (
              <ImagePackSidebarStack
                mx={mx}
                usage={usage}
                packs={imagePacks}
                activeId={firstVisibleItemId}
                onItemClick={handleScrollToItem}
              />
            )}
            {emojiTab && (
              <NativeEmojiSidebarStack
                groups={emojiGroups}
                icons={emojiGroupIcons}
                activeId={firstVisibleItemId}
                labels={emojiGroupLabels}
                onItemClick={handleScrollToItem}
              />
            )}
          </Sidebar>
        }
        footer={
          emojiTab ? (
            <Footer>
              <Box
                display="InlineFlex"
                ref={emojiPreviewRef}
                className={css.EmojiPreview}
                alignItems="Center"
                justifyContent="Center"
              >
                😃
              </Box>
              <Text ref={emojiPreviewTextRef} size="H5" truncate>
                :smiley:
              </Text>
            </Footer>
          ) : (
            imagePacks.length > 0 && (
              <Footer>
                <Text ref={emojiPreviewTextRef} size="H5" truncate>
                  :smiley:
                </Text>
              </Footer>
            )
          )
        }
      >
        <Content>
          <Scroll
            ref={contentScrollRef}
            size="400"
            // onScroll={handleOnScroll}
            onKeyDown={preventScrollWithArrowKey}
            hideTrack
          >
            <Box
              onClick={handleEmojiClick}
              onMouseMove={handleEmojiHover}
              onFocus={handleEmojiFocus}
              direction="Column"
              gap="200"
              // TODO: height on Box OK?
              style={{
                height: `${itemVirtualizer.getTotalSize()}px`,
                // width: '100%',
                position: 'relative',
              }}
            >
              {stickerTab && imagePacks.length === 0 && <NoStickers />}
              {itemVirtualizer.getVirtualItems().map((virtualRow) => {
                const { item, key } = groups[virtualRow.index];

                let component;
                if (item.kind === "search")
                  component = (
                    <SearchEmojiGroup
                      mx={mx}
                      tab={tab}
                      id={key()}
                      label={item.result.items.length ? 'Search Results' : 'No Results found'}
                      emojis={item.result.items}
                    />)
                else if (item.kind === "recent")
                  component = <RecentEmojiGroup id={key()} label="Recent" emojis={recentEmojis} />;
                else if (item.kind === "custom")
                  component = <CustomEmojiGroup mx={mx} pack={item.pack} />;
                else if (item.kind === "sticker")
                  component = <StickerGroup mx={mx} pack={item.pack} />;
                else if (item.kind === "native")
                  component = (
                    <NativeEmojiGroup
                      emojiGroup={item.emojiGroup}
                      emojiGroupLabel={emojiGroupLabels[item.emojiGroup.id]}
                    />);

                return (<VirtualTile key={virtualRow.key} virtualItem={virtualRow}>{ component }</VirtualTile>);
              })}
            </Box>
          </Scroll>
        </Content>
      </EmojiBoardLayout>
    </FocusTrap>
  );

  console.log(`react render took ${Date.now() - start}ms`); // ~ 1ms

  useEffect(() => {
    console.log(`browser render took ${Date.now() - start}ms`); // before optimization: ~ 200-500 ms (native only), >1s (with custom)
  });

  return res;
}
