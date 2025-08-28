/**
 * Discord Music Bot System - 16 Bots
 * Main Entry Point for Render Deployment
 */

const express = require('express');
const MusicBot = require('./client');
const { getValidTokens } = require('./tokens');

console.log('🚀 Starting 16-Bot Discord Music System...');

// Keep-alive server for Render
const app = express();
const PORT = process.env.PORT || 5000;

app.get('/', (req, res) => {
    const validTokens = getValidTokens();
    res.json({
        message: '🎵 Discord Music Bot System Active',
        totalBots: 16,
        activeBots: validTokens.length,
        status: 'Running 24/7',
        timestamp: new Date().toISOString(),
        bots: validTokens.map(token => ({
            id: token.id,
            status: 'Active'
        }))
    });
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/bots', (req, res) => {
    const validTokens = getValidTokens();
    res.json({
        totalBots: validTokens.length,
        bots: validTokens.map(token => ({ id: token.id }))
    });
});

// Start keep-alive server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Keep-alive server running on port ${PORT}`);
    console.log(`🌐 Health check: http://localhost:${PORT}/health`);
});

// Initialize and start all bots
async function startAllBots() {
    const validTokens = getValidTokens();
    
    if (validTokens.length === 0) {
        console.error('❌ No valid bot tokens found!');
        console.error('📝 Please make sure you have set the environment variables:');
        for (let i = 1; i <= 16; i++) {
            console.error(`   DISCORD_BOT_TOKEN_${i}`);
        }
        process.exit(1);
    }
    
    console.log(`🤖 Found ${validTokens.length}/16 valid bot tokens`);
    console.log('🔄 Starting bots...');
    
    const botPromises = validTokens.map(async (tokenData) => {
        const bot = new MusicBot(tokenData.id);
        
        try {
            await bot.start(tokenData.token);
            console.log(`✅ Bot #${tokenData.id} started successfully`);
            return bot;
        } catch (error) {
            console.error(`❌ Failed to start Bot #${tokenData.id}:`, error.message);
            return null;
        }
    });
    
    // Wait for all bots to start (or fail)
    const results = await Promise.allSettled(botPromises);
    
    const successfulBots = results.filter(result => 
        result.status === 'fulfilled' && result.value !== null
    ).length;
    
    const failedBots = results.filter(result => 
        result.status === 'rejected' || result.value === null
    ).length;
    
    console.log('\n🎯 Bot Startup Summary:');
    console.log(`✅ Successfully started: ${successfulBots}/${validTokens.length} bots`);
    
    if (failedBots > 0) {
        console.log(`❌ Failed to start: ${failedBots} bots`);
    }
    
    if (successfulBots === 0) {
        console.error('💥 No bots started successfully! Exiting...');
        process.exit(1);
    }
    
    console.log('\n🎵 Multi-Bot Music System is now running 24/7!');
    console.log('📋 Available commands:');
    console.log('   /play - Play music from YouTube');
    console.log('   /joinroom - Join voice channel');
    console.log('   /help - Show all commands');
    console.log('   /admin_botlist - List all bots (admin only)');
    console.log('\n🔗 Each bot can work independently in different voice channels');
    console.log('⏰ Bots will stay connected 24/7 until manually disconnected');
    
    // Log system info every hour
    setInterval(() => {
        console.log(`📊 System Status: ${successfulBots} bots running | ${new Date().toISOString()}`);
    }, 3600000); // 1 hour
}

// Error handling
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled Promise Rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('📴 Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('📴 Received SIGINT, shutting down gracefully...');
    process.exit(0);
});

// Start the system
startAllBots().catch((error) => {
    console.error('💥 Fatal error starting bot system:', error);
    process.exit(1);
});
