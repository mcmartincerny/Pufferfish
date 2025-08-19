const colors = {
  pear: "#C2E812",
  blue: "#337CA0",
  orange: "#FB6107",
  green: "#317B22",
  ultraWhite: "#FFFFFF",
  white: "#CCDDE2",
  purple: "#4B296B",
  black: "#171614",
  lessBlack: "#24272B",
  blueishBlack: "#0D1821",
  grey: "#606060",
};

const colorsDark = Object.entries(colors).reduce((acc, [key, value]) => {
  acc[key + "Dark"] = `${value}90`;
  return acc;
}, {} as Record<string, string>) as {
  [K in keyof typeof colors as `${K}Dark`]: string;
};

const colorsDarker = Object.entries(colors).reduce((acc, [key, value]) => {
  acc[key + "Darker"] = `${value}40`;
  return acc;
}, {} as Record<string, string>) as {
  [K in keyof typeof colors as `${K}Darker`]: string;
};

export const theme = {
  colors: {
    ...colors,
    ...colorsDark,
    ...colorsDarker,
  },
};
