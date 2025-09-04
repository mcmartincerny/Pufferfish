import { useEffect, useMemo, useRef, useState } from "react";
import styled from "@emotion/styled";
import { theme } from "../Theme";
import { getAllShipParts, getShipPartCategories, ShipPartInfo } from "../../objects/ShipParts";
import { ItemIcon } from "./ItemIcon";
import { useGameValue } from "../GameContext";
import { AnimatePresence, motion } from "framer-motion";

enum BuildCategory {
  All = "All",
}

const SHOW_PREVIEW_DELAY = 500;

export const BuildMenu = () => {
  const [mode, setMode] = useGameValue("mode");
  const [selectedCategory, setSelectedCategory] = useState<string>(BuildCategory.All);
  const [hoveredItem, setHoveredItem] = useState<ShipPartInfo | null>(null);
  const previewTimerRef = useRef<number | null>(null);

  // Get all ship parts and categories (memoized for stable identities)
  const allShipParts = useMemo(() => getAllShipParts(), []);
  const shipCategories = useMemo(() => getShipPartCategories(), []);
  const allCategories = useMemo(() => [BuildCategory.All, ...shipCategories], [shipCategories]);

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "b") {
        if (mode === "build") {
          setMode("third_person");
        } else {
          setMode("build");
        }
      } else if (event.key === "Escape" && mode === "build") {
        setMode("third_person");
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => {
      document.removeEventListener("keydown", handleKeyPress);
    };
  }, [mode, setMode]);

  const filteredItems = selectedCategory === BuildCategory.All ? allShipParts : allShipParts.filter((item) => item.category === selectedCategory);

  const handleItemHover = (item: ShipPartInfo | null) => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }

    if (item) {
      const timer = window.setTimeout(() => {
        setHoveredItem(item);
        previewTimerRef.current = null;
      }, SHOW_PREVIEW_DELAY);
      previewTimerRef.current = timer;
    } else {
      setHoveredItem(null);
    }
  };

  const handleItemLeave = () => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    setHoveredItem(null);
  };

  const [selectedItem, setSelectedItem] = useGameValue("building.selectedItem");

  const handleItemClick = (item: ShipPartInfo) => {
    // is item already selected?
    if (selectedItem?.id === item.id) {
      setSelectedItem(null);
    } else {
      setSelectedItem(item);
    }
  };

  return (
    <>
      <AnimatePresence>
        {mode === "build" && (
          <BuildMenuContainer initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ duration: 0.5 }}>
            <BuildMenuHeader>
              <BuildMenuTitle>Build Menu</BuildMenuTitle>
            </BuildMenuHeader>

            <CategoryTabs>
              {allCategories.map((category) => (
                <CategoryTab
                  key={category}
                  active={selectedCategory === category}
                  onClick={() => {
                    setSelectedCategory(category);
                    setSelectedItem(null); // Clear selection when switching categories
                  }}
                >
                  {category}
                </CategoryTab>
              ))}
            </CategoryTabs>

            <ItemsGrid>
              {filteredItems.map((item) => (
                <ItemSlot
                  key={item.id}
                  selected={selectedItem?.id === item.id}
                  onClick={() => handleItemClick(item)}
                  onMouseEnter={() => handleItemHover(item)}
                  onMouseLeave={() => handleItemLeave()}
                >
                  <ItemIconWrapper>
                    <ItemIcon partInfo={item} size="small" />
                  </ItemIconWrapper>
                  <ItemName>{item.name}</ItemName>
                  {selectedItem === item && <SelectedIndicator>✓</SelectedIndicator>}
                </ItemSlot>
              ))}
            </ItemsGrid>
          </BuildMenuContainer>
        )}
      </AnimatePresence>

      {hoveredItem && (
        <ItemPreview>
          <PreviewIconWrapper>
            <ItemIcon partInfo={hoveredItem} size="large" />
          </PreviewIconWrapper>
          <PreviewName>{hoveredItem.name}</PreviewName>
          <PreviewDescription>{hoveredItem.description}</PreviewDescription>
          <PreviewBottom>
            <PreviewWeight>{hoveredItem.weight} kg</PreviewWeight>
            <PreviewPrice>${hoveredItem.price}</PreviewPrice>
          </PreviewBottom>
        </ItemPreview>
      )}
    </>
  );
};

const BUILD_MENU_WIDTH = "min(30vw, 500px)";

const BuildMenuContainer = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  width: ${BUILD_MENU_WIDTH};
  min-width: 200px;
  height: 100vh;
  background-color: ${theme.colors.blueishBlack};
  border-right: 2px solid ${theme.colors.green};
  box-shadow: 4px 0 8px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  display: flex;
  flex-direction: column;
`;

const BuildMenuHeader = styled.div`
  padding: 16px;
  border-bottom: 1px solid ${theme.colors.grey};
  background-color: ${theme.colors.lessBlack};
`;

const BuildMenuTitle = styled.h2`
  margin: 0;
  color: ${theme.colors.orange};
  font-size: 24px;
  text-align: center;
  text-shadow: 0 0 4px ${theme.colors.orangeDark};
`;

const CategoryTabs = styled.div`
  display: flex;
  flex-wrap: wrap;
  background-color: ${theme.colors.blueishBlack};
  border-bottom: 1px solid ${theme.colors.grey};
  gap: 0;
`;

const CategoryTab = styled.button<{ active: boolean }>`
  flex: 1;
  min-width: 80px;
  padding: 12px 8px;
  background-color: ${({ active }) => (active ? theme.colors.green : "transparent")};
  color: ${({ active }) => (active ? theme.colors.white : theme.colors.ultraWhite)};
  border: none;
  border-right: 1px solid ${theme.colors.grey};
  cursor: pointer;
  font-size: 14px;
  font-weight: ${({ active }) => (active ? "bold" : "normal")};
  transition: all 0.2s ease;
  &:hover {
    background-color: ${({ active }) => (active ? theme.colors.green : theme.colors.greyDark)};
    color: ${theme.colors.ultraWhite};
    border-right-color: ${({ active }) => (active ? theme.colors.green : theme.colors.grey)};
  }
  &:last-child {
    border-right: none;
  }
  border-radius: 0;
`;

const ItemsGrid = styled.div`
  padding: 16px;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, max-content));
  gap: 8px;
  align-content: start;
  justify-items: start;
  max-height: calc(100vh - 120px);

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: ${theme.colors.orange};
    border-radius: 3px;
  }
  &::-webkit-scrollbar-track {
    background-color: ${theme.colors.blueishBlack};
  }
`;

const ItemSlot = styled.div<{ selected: boolean }>`
  width: 80px;
  height: 80px;
  background-color: ${({ selected }) => (selected ? theme.colors.green : theme.colors.lessBlack)};
  border: 2px solid ${({ selected }) => (selected ? theme.colors.ultraWhite : theme.colors.grey)};
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;

  &:hover {
    border-color: ${theme.colors.green};
    transform: scale(1.05);
    box-shadow: 0 0 8px ${theme.colors.green};
  }

  ${({ selected }) =>
    selected &&
    `
    box-shadow: 0 0 12px ${theme.colors.greenDark};
  `}
`;

const ItemIconWrapper = styled.div`
  margin-bottom: 4px;
`;

const ItemName = styled.div`
  font-size: 10px;
  color: ${theme.colors.ultraWhite};
  text-align: center;
  line-height: 1.2;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const SelectedIndicator = styled.div`
  position: absolute;
  top: -2px;
  right: -2px;
  width: 16px;
  height: 16px;
  background-color: ${theme.colors.orange};
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: bold;
  color: ${theme.colors.white};
  border: 1px solid ${theme.colors.ultraWhite};
`;

const ItemPreview = styled.div`
  position: fixed;
  top: 16px;
  left: calc(${BUILD_MENU_WIDTH} + 16px);
  min-width: 200px;
  width: 25vw;
  max-width: 300px;
  height: auto;
  max-height: calc(100vh - 32px);
  background-color: ${theme.colors.blueishBlack};
  border: 2px solid ${theme.colors.green};
  border-radius: 8px;
  box-shadow: 4px 4px 12px rgba(0, 0, 0, 0.5);
  padding: 20px;
  z-index: 1001;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: ${theme.colors.orange};
    border-radius: 3px;
  }
  &::-webkit-scrollbar-track {
    background-color: ${theme.colors.blueishBlack};
  }
`;

const PreviewIconWrapper = styled.div`
  align-self: center;
`;

const PreviewName = styled.h3`
  margin: 0;
  color: ${theme.colors.orange};
  font-size: 20px;
  text-align: center;
  text-shadow: 0 0 4px ${theme.colors.orangeDark};
`;

const PreviewDescription = styled.p`
  margin: 0;
  color: ${theme.colors.ultraWhite};
  font-size: 14px;
  line-height: 1.4;
  text-align: center;
`;

const PreviewBottom = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-top: auto;
`;

const PreviewPrice = styled.div`
  color: ${theme.colors.green};
  font-size: 16px;
  font-weight: bold;
  text-shadow: 0 0 4px ${theme.colors.greenDark};
`;

const PreviewWeight = styled.div`
  color: ${theme.colors.ultraWhite};
  font-size: 12px;
  opacity: 0.8;
`;
