import styled from "@emotion/styled";
import { theme } from "./Theme";
import { setSettingValue } from "./SettingsValues";
import { useEffect, useState } from "react";
import { clamp } from "../helpers";

export interface OverlayProps {
  blur?: boolean;
  darkenBackground?: boolean;
}

export const Overlay = styled.div<OverlayProps>`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1000;
  backdrop-filter: ${({ blur }) => (blur ? "blur(4px)" : "none")};
  background-color: ${({ darkenBackground }) => (darkenBackground ? "rgba(0, 0, 0, 0.5)" : "transparent")};
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
`;

export const MenuWindow = styled.div`
  background-color: ${theme.colors.blueishBlack};
  border-radius: 8px;
  padding: 64px;
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  gap: 16px;
  h1 {
    margin-top: -16px;
    color: ${theme.colors.orange};
  }
`;

export const MenuContent = styled.div<{ noGap?: boolean }>`
  width: min-content;
  display: flex;
  flex-direction: column;
  gap: ${({ noGap }) => (noGap ? "0" : "24px")};
  max-height: 50vh;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 64px;
  margin-right: -64px;
  button {
    width: 100%;
    background-color: ${theme.colors.green};
    color: ${theme.colors.white};
    padding: 8px 16px;
    border-radius: 8px;
    border: 2px solid ${theme.colors.green};
    font-size: 24px;
    white-space: nowrap;
    cursor: pointer;
    transition: border-color 0.3s;
    &:hover {
      /* background-color: ${theme.colors.orange}; */
      border: 2px solid ${theme.colors.ultraWhite};
    }
  }
  &::-webkit-scrollbar {
    width: 7px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: ${theme.colors.orange};
    border-radius: 20px;
  }
  &::-webkit-scrollbar-track {
    background-color: ${theme.colors.orangeDarker};
    border-radius: 20px;
  }
`;

export const HorizontalSeparator = styled.div`
  width: 100%;
  height: 1px;
  background-color: ${theme.colors.greyDark};
  flex-shrink: 0;
`;

interface ValueSettingProps {
  name: string;
  category: string;
  setting: {
    default: boolean | number | string;
    value: boolean | number | string;
    min?: number;
    max?: number;
    step?: number;
    options?: string[];
    description?: string;
  };
}

const ValueSettingWrapper = styled.div`
  width: 65vw;
  max-width: 800px;
  margin-top: 16px;
  margin-bottom: 16px;
  color: ${theme.colors.ultraWhite};
`;

const ValueSettingHorizontalLayout = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  align-items: baseline;
  gap: 16px;
  & > * {
    width: 60%;
    /* white-space: nowrap; */
    text-align: left;
  }
  label {
    width: 40%;
    font-size: 18px;
  }
`;

const Description = styled.div`
  margin-top: 8px;
  color: ${theme.colors.ultraWhiteDark};
  text-align: left;
`;

export const ValueSetting = ({ name, category, setting }: ValueSettingProps) => {
  return (
    <ValueSettingWrapper>
      <ValueSettingHorizontalLayout>
        <label htmlFor={name}>{getSettingLabelFromKey(name)}</label>
        {typeof setting.value === "boolean" && (
          <Switch
            value={setting.value as boolean}
            possibleValues={[true, false]}
            onChange={(toggled) => {
              setSettingValue(category, name, toggled);
            }}
          />
        )}
        {typeof setting.value === "string" && setting.options && (
          <Switch
            value={setting.value}
            possibleValues={setting.options}
            onChange={(value) => {
              setSettingValue(category, name, value);
            }}
          />
        )}
        {typeof setting.value === "number" && (
          <SliderWithNumberInput
            value={setting.value as number}
            min={setting.min!}
            max={setting.max!}
            step={setting.step!}
            onChange={(value: number) => {
              setSettingValue(category, name, value);
            }}
          />
        )}
      </ValueSettingHorizontalLayout>
      {setting.description && (
        <Description>
          <div>{setting.description}</div>
        </Description>
      )}
    </ValueSettingWrapper>
  );
};

const getSettingLabelFromKey = (key: string) => {
  return (
    key
      // Match points where a lowercase letter is followed by an uppercase letter, or where a number is followed by a letter
      .split(/(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])|(?<=[a-zA-Z])(?=\d)/)
      .map((word, i) => (i === 0 ? word[0].toUpperCase() : word[0]) + word.slice(1))
      .join(" ")
  );
};

interface SwitchProps {
  value: boolean | number | string;
  possibleValues: (boolean | number | string)[];
  onChange: (value: boolean | number | string) => void;
}

const SwitchWrapper = styled.div`
  /* width: 80px; */
  height: 30px;
  border: 2px solid ${theme.colors.green};
  border-radius: 8px;
  display: flex;
  flex-direction: row;
  cursor: pointer;
`;

const SwitchItem = styled.div<{ borderLeft: boolean; animation: string; animationTime: number }>`
  flex-grow: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  font-weight: bold;
  user-select: none;
  letter-spacing: 0px;
  border-left: ${({ borderLeft }) => (borderLeft ? `2px solid ${theme.colors.green}` : "none")};
  padding-left: ${({ borderLeft }) => (borderLeft ? "0px" : "2px")};
  color: ${(props) => (props.animation.includes("entering") ? theme.colors.ultraWhite : theme.colors.green)};
  transition: color 0.3s;

  &:hover {
    color: ${theme.colors.ultraWhite};
  }

  background: linear-gradient(90deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0) 50%, ${theme.colors.green} 50%);
  background-size: 204% 100%; /* Double the size to allow movement */
  background-position: 0% 0%;
  animation: ${(props) => props.animation} linear ${(props) => props.animationTime}s forwards;

  @keyframes entering-left {
    0% {
      background-position: 0% 0%;
    }
    100% {
      background-position: 99% 0%;
    }
  }

  @keyframes entering-right {
    0% {
      background-position: 200% 0%;
    }
    100% {
      background-position: 99% 0%;
    }
  }

  @keyframes leaving-right {
    0% {
      background-position: 99% 0%;
    }
    100% {
      background-position: 0% 0%;
    }
  }

  @keyframes leaving-left {
    0% {
      background-position: 99% 0%;
    }
    100% {
      background-position: 200% 0%;
    }
  }
`;

const switchTotalAnimationTime = 0.5;
const Switch = ({ value, onChange, possibleValues }: SwitchProps) => {
  const [firstRender, setFirstRender] = useState(true);
  useEffect(() => {
    setTimeout(() => setFirstRender(false), 500);
  }, []);
  const [lastIndex, setLastIndex] = useState(possibleValues.indexOf(value));
  const [indexOfLastHighlightedValue, setIndexOfLastHighlightedValue] = useState(possibleValues.indexOf(value));
  const indexOfLastSelectedValue = possibleValues.indexOf(value);
  const directionLeft = lastIndex > indexOfLastSelectedValue;
  const direction = directionLeft ? -1 : 1;
  let highlightedIndex = Math.min(possibleValues.length - 1, Math.max(0, indexOfLastHighlightedValue + direction));
  if (indexOfLastHighlightedValue === indexOfLastSelectedValue) {
    highlightedIndex = indexOfLastSelectedValue;
  }
  let animationTime =
    lastIndex - indexOfLastSelectedValue === 0 ? switchTotalAnimationTime : switchTotalAnimationTime / Math.abs(lastIndex - indexOfLastSelectedValue);
  animationTime = firstRender ? 0 : animationTime;
  useEffect(() => {
    const timeout = setTimeout(() => {
      setIndexOfLastHighlightedValue(highlightedIndex);
    }, animationTime * 1000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastIndex, highlightedIndex]);
  return (
    <SwitchWrapper>
      {possibleValues.map((possibleValue, i) => {
        const shouldAnimate = i === highlightedIndex || i === indexOfLastHighlightedValue;
        const adjustedAnimationTime = shouldAnimate ? animationTime : 0;
        const animationName = shouldAnimate ? (i === highlightedIndex ? "entering" : "leaving") : "none";
        const animationNameWithDirection = shouldAnimate ? `${animationName}-${directionLeft ? "left" : "right"}` : animationName;
        return (
          <SwitchItem
            key={i}
            animation={animationNameWithDirection}
            animationTime={adjustedAnimationTime}
            borderLeft={i > 0 && !(i !== highlightedIndex && indexOfLastHighlightedValue === indexOfLastSelectedValue && i === indexOfLastSelectedValue)}
            onClick={() => {
              if (value === possibleValue) return;
              setLastIndex(indexOfLastSelectedValue);
              onChange(possibleValue);
            }}
          >
            {typeof possibleValue === "boolean" ? (possibleValue ? "ON" : "OFF") : possibleValue.toString().toUpperCase()}
          </SwitchItem>
        );
      })}
    </SwitchWrapper>
  );
};

interface SliderWithNumberInputProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

const SliderWithNumberInputWrapper = styled.div`
  height: 34px;
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  align-items: center;
  gap: 16px;
`;

const Slider = styled.input`
  width: 100%;
  -webkit-appearance: none;
  -moz-appearance: none;
  margin: 0px;
  height: 30px;
  outline: none;
  background-color: transparent;
  border: 2px solid ${theme.colors.green};
  border-radius: 8px;
  cursor: pointer;

  &:hover {
    border: 2px solid ${theme.colors.ultraWhite};
  }

  &::-webkit-slider-runnable-track {
    margin: 3px;
  }
  &::-moz-range-track {
    margin: 3px;
  }

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 24px;
    height: 24px;
    border-radius: 4px;
    background-color: ${theme.colors.green};
    cursor: pointer;
  }
  &::-moz-range-thumb {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    background-color: ${theme.colors.green};
    border: none;
    cursor: pointer;
  }
`;

const NumberInput = styled.input`
  height: 30px;
  width: 50px;
  padding: 0px 10px;
  color: ${theme.colors.ultraWhite};
  border-radius: 8px;
  border: 2px solid ${theme.colors.green};
  background-color: transparent;
  outline: none !important;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.3s;
  &:hover,
  &:focus,
  &:active {
    border: 2px solid ${theme.colors.ultraWhite};
  }
`;

export const SliderWithNumberInput = ({ value, min, max, step, onChange }: SliderWithNumberInputProps) => {
  const [valueString, setValueString] = useState(value.toString());

  useEffect(() => {
    setValueString(value.toString());
  }, [value]);

  return (
    <SliderWithNumberInputWrapper>
      <Slider
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          onChange(parseFloat(e.target.value));
          setValueString(e.target.value.toString());
        }}
      />
      <NumberInput
        type="text"
        value={valueString}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          if (e.target.value.length === 0) {
            setValueString("");
            console.log("empty");
            return;
          }
          if ([".", ","].includes(e.target.value.charAt(e.target.value.length - 1))) {
            const stringWithoutLastChar = e.target.value.slice(0, -1);
            setValueString(stringWithoutLastChar + ".");
            console.log("dot");
            return;
          }
          let valueWithoutLetters = e.target.value.replace(/,/g, ".");
          valueWithoutLetters = valueWithoutLetters.replace(/[^0-9.]/g, "");
          let newValue = parseFloat(valueWithoutLetters);
          if (isNaN(newValue)) {
            console.log("nan");
            newValue = value;
          }
          console.log(newValue);
          onChange(newValue);
          setValueString(newValue.toString());
        }}
        onBlur={(e) => {
          let newValue = parseFloat(e.target.value);
          if (isNaN(newValue)) {
            newValue = value;
          }
          newValue = clamp(newValue, min, max);
          onChange(newValue);
          setValueString(newValue.toString());
        }}
      />
    </SliderWithNumberInputWrapper>
  );
};

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  width?: string;
}

export const TextInput = ({ value, onChange, label, width }: TextInputProps) => {
  return (
    <TextInputWrapper>
      {label && <label htmlFor={label}>{label}</label>}
      <TextInputInput value={value} onChange={(e) => onChange(e.target.value)} width={width} />
    </TextInputWrapper>
  );
};

const TextInputWrapper = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  align-items: center;
  gap: 16px;
`;

const TextInputInput = styled.input<{ width?: string }>`
  height: 30px;
  width: ${({ width }) => width || "100%"};
  padding: 0px 10px;
  color: ${theme.colors.ultraWhite};
  border-radius: 8px;
  border: 2px solid ${theme.colors.green};
  background-color: transparent;
  outline: none !important;
  font-size: 16px;
  &:hover,
  &:focus,
  &:active {
    border: 2px solid ${theme.colors.ultraWhite};
  }
`;

export const WrapperWithLabel = ({ label, children }: { label: string; children: React.ReactNode }) => {
  return (
    <WrapperWithLabelWrapper>
      <label htmlFor={label}>{label}</label>
      {children}
    </WrapperWithLabelWrapper>
  );
};

const WrapperWithLabelWrapper = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  align-items: center;
  gap: 16px;
`;

export const FlexRowNoWrap = styled.div<{ center?: boolean }>`
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  width: 100%;
  gap: 16px;
  ${({ center }) => center && `justify-content: center;`}
`;

export const FlexRowWrap = styled(FlexRowNoWrap)`
  flex-wrap: wrap;
`;

export const SmallButton = styled.button`
  height: 34px;
  width: min-content !important;
  font-size: 18px !important;
  padding: 0 8px !important;
`;
