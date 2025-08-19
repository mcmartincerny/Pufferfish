import styled from "@emotion/styled";
import { HorizontalSeparator, MenuContent, ValueSetting } from "./Components";
import { applySettings, discardSettings, getCategories, useGetCategoryWithOptions } from "./SettingsValues";
import { theme } from "./Theme";
import { useState } from "react";

interface SettingsProps {
  closeSettings: () => void;
  reloadGame: () => void;
}

export const Settings = ({ closeSettings, reloadGame }: SettingsProps) => {
  const categories = getCategories();
  const [category, setCategory] = useState<(typeof categories)[0]>();
  const categorySettings = useGetCategoryWithOptions(category);
  return (
    <>
      <h1>{category ?? "Settings"}</h1>
      <MenuContent noGap={!!category}>
        {category == null && (
          <>
            {categories.map((category) => (
              <button key={category} onClick={() => setCategory(category)}>
                {category}
              </button>
            ))}
          </>
        )}
        {categorySettings && category && (
          <>
            {Object.entries(categorySettings).map((entry, i) => (
              <>
                {i > 0 && <HorizontalSeparator />}
                <ValueSetting key={entry[0]} name={entry[0]} category={category} setting={entry[1]} />
              </>
            ))}
          </>
        )}
      </MenuContent>
      {category == null ? (
        <ApplyAndDiscardButtons closeSettings={closeSettings} reloadGame={reloadGame} />
      ) : (
        <BottomButtons>
          <button className="secondary" onClick={() => setCategory(undefined)}>
            Back
          </button>
        </BottomButtons>
      )}
    </>
  );
};

export const BottomButtons = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: baseline;
  margin-top: 16px;
  margin-bottom: -32px;
  margin-left: -32px;
  margin-right: -32px;
  gap: 128px;
  button {
    width: 100%;
    background-color: ${theme.colors.orange};
    color: ${theme.colors.ultraWhite};
    padding: 8px 16px;
    border-radius: 8px;
    border: 2px solid ${theme.colors.orange};
    font-size: 24px;
    cursor: pointer;
    border: 2px solid transparent;
    transition: border-color 0.3s;
    :hover {
      border-color: ${theme.colors.ultraWhite} !important;
    }
  }
  button.secondary {
    color: ${theme.colors.orange};
    background-color: transparent;
    border: 2px solid ${theme.colors.orange};
    border-radius: 8px;
  }
`;

const ApplyAndDiscardButtons = ({ closeSettings, reloadGame }: SettingsProps) => {
  return (
    <BottomButtons>
      <button
        onClick={() => {
          const changesRequireReload = applySettings();
          if (changesRequireReload) {
            reloadGame();
            closeSettings();
          } else {
            closeSettings();
          }
        }}
      >
        Apply
      </button>
      <button
        className="secondary"
        onClick={() => {
          discardSettings();
          closeSettings();
        }}
      >
        Discard
      </button>
    </BottomButtons>
  );
};
