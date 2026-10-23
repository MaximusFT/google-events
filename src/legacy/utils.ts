const alwaysLowercase = ['of', 'the'];
const alwaysUppercase = ['UK', 'US', 'USA'];

/**
 * Makes first letter in a string uppercased.
 *
 * @param {string} str Source string.
 * @returns {String} Uppercased string.
 */
export function upperCaseFirstLetter(str: string) {
  if (!str || typeof str !== 'string') {
    return str;
  }
  if (alwaysLowercase.includes(str.toLowerCase())) return str.toLowerCase();
  if (alwaysUppercase.includes(str.toUpperCase())) return str.toUpperCase();
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Makes first letters in a string uppercased.
 *
 * @param {string} str Source string.
 * @returns {String} Uppercased string.
 */
export function upperCaseFirstLetters(str: string) {
  if (!str || typeof str !== 'string') {
    return str;
  }
  return str
    .split(' ')
    .map((word) => upperCaseFirstLetter(word.toLowerCase()))
    .join(' ');
}

/**
 * Converts string to camelcased string.
 *
 * @param {string} str Source string.
 * @param {string=} separator String which separates words in a given string. Default: space.
 * @returns {String} Camelcased string.
 */
export function toCamelCase(str: string, separator: string = ' ') {
  if (!str || typeof str !== 'string') {
    return str;
  }
  return str
    .split(separator)
    .map((part, index) => (index > 0 ? upperCaseFirstLetter(part) : part))
    .join('');
}

export const inverseBoolean = (value: string): string => {
  if (value === 'true') {
    return 'false';
  }
  if (value === 'false') {
    return 'true';
  }
  return 'false';
};
