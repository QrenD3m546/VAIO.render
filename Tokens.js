/**
 * Discord Bot Tokens Management
 * 16-Bot System Configuration
 */

const tokens = {
    DISCORD_BOT_TOKEN_1: process.env.DISCORD_BOT_TOKEN_1,
    DISCORD_BOT_TOKEN_2: process.env.DISCORD_BOT_TOKEN_2,
    DISCORD_BOT_TOKEN_3: process.env.DISCORD_BOT_TOKEN_3,
    DISCORD_BOT_TOKEN_4: process.env.DISCORD_BOT_TOKEN_4,
    DISCORD_BOT_TOKEN_5: process.env.DISCORD_BOT_TOKEN_5,
    DISCORD_BOT_TOKEN_6: process.env.DISCORD_BOT_TOKEN_6,
    DISCORD_BOT_TOKEN_7: process.env.DISCORD_BOT_TOKEN_7,
    DISCORD_BOT_TOKEN_8: process.env.DISCORD_BOT_TOKEN_8,
    DISCORD_BOT_TOKEN_9: process.env.DISCORD_BOT_TOKEN_9,
    DISCORD_BOT_TOKEN_10: process.env.DISCORD_BOT_TOKEN_10,
    DISCORD_BOT_TOKEN_11: process.env.DISCORD_BOT_TOKEN_11,
    DISCORD_BOT_TOKEN_12: process.env.DISCORD_BOT_TOKEN_12,
    DISCORD_BOT_TOKEN_13: process.env.DISCORD_BOT_TOKEN_13,
    DISCORD_BOT_TOKEN_14: process.env.DISCORD_BOT_TOKEN_14,
    DISCORD_BOT_TOKEN_15: process.env.DISCORD_BOT_TOKEN_15,
    DISCORD_BOT_TOKEN_16: process.env.DISCORD_BOT_TOKEN_16
};

/**
 * Get all valid tokens
 * @returns {Array} Array of {id, token} objects
 */
function getValidTokens() {
    const validTokens = [];
    
    for (let i = 1; i <= 16; i++) {
        const token = tokens[`DISCORD_BOT_TOKEN_${i}`];
        if (token && token.trim()) {
            validTokens.push({
                id: i,
                token: token.trim()
            });
        }
    }
    
    return validTokens;
}

/**
 * Get token by bot number
 * @param {number} botNumber Bot number (1-16)
 * @returns {string|null} Token or null if not found
 */
function getToken(botNumber) {
    const token = tokens[`DISCORD_BOT_TOKEN_${botNumber}`];
    return token && token.trim() ? token.trim() : null;
}

/**
 * Check if token exists for bot number
 * @param {number} botNumber Bot number (1-16)
 * @returns {boolean} True if token exists
 */
function hasToken(botNumber) {
    return !!getToken(botNumber);
}

/**
 * Get total number of valid tokens
 * @returns {number} Count of valid tokens
 */
function getTokenCount() {
    return getValidTokens().length;
}

module.exports = {
    tokens,
    getValidTokens,
    getToken,
    hasToken,
    getTokenCount
};
