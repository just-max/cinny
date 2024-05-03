import React, { MouseEventHandler, useCallback, useMemo, useRef, useState } from 'react';
import { Box, Icon, IconButton, Icons, Line, Scroll, config } from 'folds';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useAtom, useAtomValue } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { Room } from 'matrix-js-sdk';
import { useSpace } from '../../hooks/useSpace';
import { Page, PageContent, PageContentCenter, PageHeroSection } from '../../components/page';
import { HierarchyItem, useSpaceHierarchy } from '../../hooks/useSpaceHierarchy';
import { VirtualTile } from '../../components/virtualizer';
import { spaceRoomsAtom } from '../../state/spaceRooms';
import { MembersDrawer } from '../room/MembersDrawer';
import { useSetting } from '../../state/hooks/settings';
import { ScreenSize, useScreenSize } from '../../hooks/useScreenSize';
import { settingsAtom } from '../../state/settings';
import { LobbyHeader } from './LobbyHeader';
import { LobbyHero } from './LobbyHero';
import { ScrollTopContainer } from '../../components/scroll-top-container';
import { useElementSizeObserver } from '../../hooks/useElementSizeObserver';
import {
  DefaultPowerLevels,
  PowerLevelsContextProvider,
  powerLevelAPI,
  usePowerLevels,
  useRoomsPowerLevels,
} from '../../hooks/usePowerLevels';
import { RoomItemCard } from './RoomItem';
import { mDirectAtom } from '../../state/mDirectList';
import { SpaceItemCard } from './SpaceItem';
import { closedLobbyCategoriesAtom, makeLobbyCategoryId } from '../../state/closedLobbyCategory';
import { useCategoryHandler } from '../../hooks/useCategoryHandler';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { allRoomsAtom } from '../../state/room-list/roomList';
import { getCanonicalAliasOrRoomId } from '../../utils/matrix';
import { getSpaceRoomPath } from '../../pages/pathUtils';
import { HierarchyItemMenu } from './HierarchyItemMenu';
import { StateEvent } from '../../../types/matrix/room';

export function Lobby() {
  const navigate = useNavigate();
  const mx = useMatrixClient();
  const mDirects = useAtomValue(mDirectAtom);
  const allRooms = useAtomValue(allRoomsAtom);
  const allJoinedRooms = useMemo(() => new Set(allRooms), [allRooms]);
  const space = useSpace();
  const powerLevels = usePowerLevels(space);

  const scrollRef = useRef<HTMLDivElement>(null);
  const heroSectionRef = useRef<HTMLDivElement>(null);
  const [heroSectionHeight, setHeroSectionHeight] = useState<number>();
  const [spaceRooms, setSpaceRooms] = useAtom(spaceRoomsAtom);
  const [isDrawer] = useSetting(settingsAtom, 'isPeopleDrawer');
  const screenSize = useScreenSize();
  const [onTop, setOnTop] = useState(true);
  const [closedCategories, setClosedCategories] = useAtom(closedLobbyCategoriesAtom);

  useElementSizeObserver(
    useCallback(() => heroSectionRef.current, []),
    useCallback((w, height) => setHeroSectionHeight(height), [])
  );

  const flattenHierarchy = useSpaceHierarchy(
    space.roomId,
    spaceRooms,
    useCallback(
      (rId) => {
        if (allJoinedRooms.has(rId)) {
          return mx.getRoom(rId) ?? undefined;
        }
        return undefined;
      },
      [mx, allJoinedRooms]
    ),
    useCallback(
      (childId) => closedCategories.has(makeLobbyCategoryId(space.roomId, childId)),
      [closedCategories, space.roomId]
    )
  );

  const virtualizer = useVirtualizer({
    count: flattenHierarchy.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 1,
    overscan: 2,
    paddingStart: heroSectionHeight ?? 258,
  });
  const vItems = virtualizer.getVirtualItems();

  const hierarchySpaces: Room[] = useMemo(
    () =>
      flattenHierarchy
        .filter((i) => i.space && allJoinedRooms.has(i.roomId) && !!mx.getRoom(i.roomId))
        .map((i) => mx.getRoom(i.parentId ?? i.roomId)) as Room[],
    [mx, allJoinedRooms, flattenHierarchy]
  );
  const roomsPowerLevels = useRoomsPowerLevels(hierarchySpaces);

  const addSpaceRoom = (roomId: string) => setSpaceRooms({ type: 'PUT', roomId });

  const handleCategoryClick = useCategoryHandler(setClosedCategories, (categoryId) =>
    closedCategories.has(categoryId)
  );

  const handleOpenRoom: MouseEventHandler<HTMLButtonElement> = (evt) => {
    const rId = evt.currentTarget.getAttribute('data-room-id');
    if (!rId) return;
    const pSpaceIdOrAlias = getCanonicalAliasOrRoomId(mx, space.roomId);
    navigate(getSpaceRoomPath(pSpaceIdOrAlias, getCanonicalAliasOrRoomId(mx, rId)));
  };

  return (
    <PowerLevelsContextProvider value={powerLevels}>
      <Box grow="Yes">
        <Page>
          <LobbyHeader showProfile={!onTop} />
          <Box style={{ position: 'relative' }} grow="Yes">
            <Scroll ref={scrollRef} hideTrack visibility="Hover">
              <PageContent>
                <PageContentCenter>
                  <ScrollTopContainer
                    scrollRef={scrollRef}
                    anchorRef={heroSectionRef}
                    onVisibilityChange={setOnTop}
                  >
                    <IconButton
                      onClick={() => virtualizer.scrollToOffset(0)}
                      variant="SurfaceVariant"
                      radii="Pill"
                      outlined
                      size="300"
                      aria-label="Scroll to Top"
                    >
                      <Icon src={Icons.ChevronTop} size="300" />
                    </IconButton>
                  </ScrollTopContainer>
                  <div
                    style={{
                      position: 'relative',
                      height: virtualizer.getTotalSize(),
                    }}
                  >
                    <PageHeroSection ref={heroSectionRef} style={{ paddingTop: 0 }}>
                      <LobbyHero />
                    </PageHeroSection>
                    {vItems.map((vItem) => {
                      const item = flattenHierarchy[vItem.index];
                      const { parentId } = item;
                      if (!item) return null;
                      const parentPowerLevel =
                        parentId && (roomsPowerLevels.get(parentId) ?? DefaultPowerLevels);
                      const canEditSpaceChild =
                        parentPowerLevel &&
                        powerLevelAPI.canSendStateEvent(
                          parentPowerLevel,
                          StateEvent.SpaceChild,
                          powerLevelAPI.getPowerLevel(parentPowerLevel, mx.getUserId() ?? undefined)
                        );
                      if (item.space) {
                        const categoryId = makeLobbyCategoryId(space.roomId, item.roomId);

                        return (
                          <VirtualTile
                            virtualItem={vItem}
                            style={{
                              paddingTop: vItem.index === 0 ? 0 : config.space.S500,
                            }}
                            ref={virtualizer.measureElement}
                            key={vItem.index}
                          >
                            <SpaceItemCard
                              item={item}
                              joined={allJoinedRooms.has(item.roomId)}
                              categoryId={categoryId}
                              closed={closedCategories.has(categoryId)}
                              handleClose={handleCategoryClick}
                              options={
                                parentId && canEditSpaceChild ? (
                                  <HierarchyItemMenu item={{ ...item, parentId }} />
                                ) : undefined
                              }
                            />
                          </VirtualTile>
                        );
                      }

                      const prevItem: HierarchyItem | undefined = flattenHierarchy[vItem.index - 1];
                      const nextItem: HierarchyItem | undefined = flattenHierarchy[vItem.index + 1];
                      return (
                        <VirtualTile
                          virtualItem={vItem}
                          style={{ paddingTop: config.space.S100 }}
                          ref={virtualizer.measureElement}
                          key={vItem.index}
                        >
                          <RoomItemCard
                            item={item}
                            onSpaceFound={addSpaceRoom}
                            dm={mDirects.has(item.roomId)}
                            firstChild={!prevItem || prevItem.space === true}
                            lastChild={!nextItem || nextItem.space === true}
                            onOpen={handleOpenRoom}
                            options={
                              canEditSpaceChild ? <HierarchyItemMenu item={item} /> : undefined
                            }
                          />
                        </VirtualTile>
                      );
                    })}
                  </div>
                </PageContentCenter>
              </PageContent>
            </Scroll>
          </Box>
        </Page>
        {screenSize === ScreenSize.Desktop && isDrawer && (
          <>
            <Line variant="Background" direction="Vertical" size="300" />
            <MembersDrawer room={space} />
          </>
        )}
      </Box>
    </PowerLevelsContextProvider>
  );
}