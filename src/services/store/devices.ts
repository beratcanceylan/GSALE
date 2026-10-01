/** Hardware is taken from product labels, never inferred from the game being on a store. */
export function productDevices(platform: string, title: string): string[] {
  const devices: string[] = [];
  if (platform === 'PlayStation') {
    if (/\bPS4\b/i.test(title)) devices.push('PlayStation 4');
    if (/\bPS5\b/i.test(title)) devices.push('PlayStation 5');
  } else if (platform === 'Xbox') {
    if (/\bXbox One\b/i.test(title)) devices.push('Xbox One');
    if (/\bXbox Series\b/i.test(title)) devices.push('Xbox Series X|S');
    if (/\(\s*PC\s*\)/i.test(title)) devices.push('PC');
  } else if (platform === 'Nintendo') {
    if (/\bSwitch 2\b/i.test(title)) devices.push('Nintendo Switch 2');
    if (/\bSwitch\b(?! 2)/i.test(title)) devices.push('Nintendo Switch');
  }
  return devices;
}
