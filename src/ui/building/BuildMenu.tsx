import { useEffect, useState } from "react";
import styled from "@emotion/styled";
import { theme } from "../Theme";

export interface BuildItem {
  id: string;
  name: string;
  category: string;
  icon?: string; // For future icon support
  description: string;
  price: number;
  weight: number;
}

enum BuildCategory {
  All = "All",
  Blocks = "Blocks",
  Tools = "Tools",
  Vehicles = "Vehicles",
}

// Sample items - these can be replaced with actual game items later
const SAMPLE_ITEMS: BuildItem[] = [
  {
    id: "wood-block",
    name: "Wood Block",
    category: BuildCategory.Blocks,
    description: "A sturdy wooden block perfect for building structures. Lightweight and easy to work with.",
    price: 5,
    weight: 2.5,
  },
  {
    id: "stone-block",
    name: "Stone Block",
    category: BuildCategory.Blocks,
    description: "Heavy stone block for durable construction. Provides excellent structural integrity.",
    price: 12,
    weight: 15.0,
  },
  {
    id: "metal-block",
    name: "Metal Block",
    category: BuildCategory.Blocks,
    description: "Reinforced metal block with superior strength. Ideal for secure buildings.",
    price: 25,
    weight: 22.0,
  },
  {
    id: "glass-block",
    name: "Glass Block",
    category: BuildCategory.Blocks,
    description: "Transparent glass block for windows and decorative elements. Allows light to pass through.",
    price: 18,
    weight: 8.0,
  },
  {
    id: "hammer",
    name: "Hammer",
    category: BuildCategory.Tools,
    description: "Essential building tool for construction work. Perfect for driving nails and breaking blocks.",
    price: 35,
    weight: 1.8,
  },
  {
    id: "wrench",
    name: "Wrench",
    category: BuildCategory.Tools,
    description: "Adjustable wrench for tightening bolts and assembling mechanical parts.",
    price: 28,
    weight: 1.2,
  },
  {
    id: "saw",
    name: "Saw",
    category: BuildCategory.Tools,
    description: "Sharp saw for cutting wood and other materials. Essential for precision work.",
    price: 42,
    weight: 2.1,
  },
  {
    id: "boat",
    name: "Boat",
    category: BuildCategory.Vehicles,
    description: "Small watercraft for exploring oceans and rivers. Requires water to operate.",
    price: 180,
    weight: 45.0,
  },
  {
    id: "car",
    name: "Car",
    category: BuildCategory.Vehicles,
    description: "Four-wheeled vehicle for land transportation. Fast and reliable on roads.",
    price: 320,
    weight: 1200.0,
  },
];

const BuildMenuContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 30vw;
  min-width: 200px;
  height: 100vh;
  background-color: ${theme.colors.blueishBlack};
  border-right: 2px solid ${theme.colors.green};
  box-shadow: 4px 0 8px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  transform: translateX(-100%);
  transition: transform 0.3s ease-in-out;
  &.open {
    transform: translateX(0);
  }
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
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 8px;
  align-content: start;
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

const ItemIcon = styled.div`
  width: 40px;
  height: 40px;
  background-color: ${theme.colors.grey};
  border-radius: 4px;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: ${theme.colors.ultraWhite};
  border: 1px solid ${theme.colors.greyDark};
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
  left: calc(30vw + 16px);
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

const PreviewIcon = styled.div`
  width: 80px;
  height: 80px;
  background-color: ${theme.colors.grey};
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  color: ${theme.colors.ultraWhite};
  border: 2px solid ${theme.colors.greyDark};
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

export const BuildMenu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<BuildCategory>(BuildCategory.All);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [hoveredItem, setHoveredItem] = useState<BuildItem | null>(null);
  const [previewTimer, setPreviewTimer] = useState<number | null>(null);

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "b") {
        setIsOpen((prev) => !prev);
      } else if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => {
      document.removeEventListener("keydown", handleKeyPress);
    };
  }, [isOpen]);

  const filteredItems = selectedCategory === BuildCategory.All ? SAMPLE_ITEMS : SAMPLE_ITEMS.filter((item) => item.category === selectedCategory);

  const handleItemHover = (item: BuildItem | null) => {
    if (previewTimer) {
      clearTimeout(previewTimer);
      setPreviewTimer(null);
    }

    if (item) {
      const timer = setTimeout(() => {
        setHoveredItem(item);
      }, 1000); // Show preview after 1 second
      setPreviewTimer(timer);
    } else {
      setHoveredItem(null);
    }
  };

  const handleItemLeave = () => {
    if (previewTimer) {
      clearTimeout(previewTimer);
      setPreviewTimer(null);
    }
    setHoveredItem(null);
  };

  const handleItemClick = (itemId: string) => {
    setSelectedItemId((prev) => (prev === itemId ? null : itemId));
    // TODO: Integrate with building system later
    console.log("Selected item:", itemId);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <BuildMenuContainer className={isOpen ? "open" : ""}>
        <BuildMenuHeader>
          <BuildMenuTitle>Build Menu</BuildMenuTitle>
        </BuildMenuHeader>

        <CategoryTabs>
          {Object.values(BuildCategory).map((category) => (
            <CategoryTab
              key={category}
              active={selectedCategory === category}
              onClick={() => {
                setSelectedCategory(category);
                setSelectedItemId(null); // Clear selection when switching categories
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
              selected={selectedItemId === item.id}
              onClick={() => handleItemClick(item.id)}
              onMouseEnter={() => handleItemHover(item)}
              onMouseLeave={() => handleItemLeave()}
            >
              <ItemIcon>{item.icon || item.name.charAt(0)}</ItemIcon>
              <ItemName>{item.name}</ItemName>
              {selectedItemId === item.id && <SelectedIndicator>✓</SelectedIndicator>}
            </ItemSlot>
          ))}
        </ItemsGrid>
      </BuildMenuContainer>

      {hoveredItem && isOpen && (
        <ItemPreview>
          <PreviewIcon>{hoveredItem.icon || hoveredItem.name.charAt(0)}</PreviewIcon>
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
