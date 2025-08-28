/**
 * Discord Music Bot Client
 * 16-Bot System with 24/7 Operation and Slash Commands
 */

const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes, Collection } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, VoiceConnectionStatus, AudioPlayerStatus, getVoiceConnection } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const YouTubeSearchAPI = require('youtube-search-api');

class MusicBot {
    constructor(botNumber) {
        this.botNumber = botNumber;
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildVoiceStates
            ]
        });
        
        this.musicPlayers = new Collection();
        this.setupEventHandlers();
        this.setupSlashCommands();
    }

    setupEventHandlers() {
        this.client.once('ready', async () => {
            console.log(`✅ Bot #${this.botNumber} (${this.client.user.tag}) is ready!`);
            console.log(`📊 Bot #${this.botNumber} is in ${this.client.guilds.cache.size} servers`);
            
            // Set bot activity
            this.client.user.setActivity(`🎵 Bot #${this.botNumber} | /help`, { type: 2 });
            
            // Sync slash commands
            await this.syncSlashCommands();
        });

        this.client.on('guildCreate', (guild) => {
            console.log(`🔗 Bot #${this.botNumber} joined guild: ${guild.name}`);
        });

        this.client.on('guildDelete', (guild) => {
            console.log(`❌ Bot #${this.botNumber} left guild: ${guild.name}`);
            this.musicPlayers.delete(guild.id);
        });

        this.client.on('interactionCreate', async (interaction) => {
            if (!interaction.isChatInputCommand()) return;
            
            try {
                await this.handleSlashCommand(interaction);
            } catch (error) {
                console.error(`❌ Error handling command for Bot #${this.botNumber}:`, error);
                
                const errorEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('❌ Error')
                    .setDescription('حدث خطأ أثناء تنفيذ الأمر!')
                    .setFooter({ text: `Bot #${this.botNumber}` });
                
                if (!interaction.replied) {
                    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
                }
            }
        });
    }

    setupSlashCommands() {
        this.commands = [
            // Music Commands
            new SlashCommandBuilder()
                .setName('play')
                .setDescription('Play music from YouTube')
                .addStringOption(option =>
                    option.setName('query')
                        .setDescription('YouTube URL or search query')
                        .setRequired(true)
                ),
            
            new SlashCommandBuilder()
                .setName('pause')
                .setDescription('Pause current song'),
            
            new SlashCommandBuilder()
                .setName('resume')
                .setDescription('Resume paused song'),
            
            new SlashCommandBuilder()
                .setName('skip')
                .setDescription('Skip current song'),
            
            new SlashCommandBuilder()
                .setName('stop')
                .setDescription('Stop music and clear queue'),
            
            new SlashCommandBuilder()
                .setName('queue')
                .setDescription('Show music queue'),
            
            new SlashCommandBuilder()
                .setName('nowplaying')
                .setDescription('Show currently playing song'),
            
            new SlashCommandBuilder()
                .setName('volume')
                .setDescription('Set volume (0-100)')
                .addIntegerOption(option =>
                    option.setName('level')
                        .setDescription('Volume level (0-100)')
                        .setRequired(true)
                        .setMinValue(0)
                        .setMaxValue(100)
                ),
            
            // Voice Commands
            new SlashCommandBuilder()
                .setName('joinroom')
                .setDescription('Join a voice channel')
                .addStringOption(option =>
                    option.setName('channel_name')
                        .setDescription('Voice channel name')
                        .setRequired(true)
                ),
            
            new SlashCommandBuilder()
                .setName('leave')
                .setDescription('Leave current voice channel'),
            
            new SlashCommandBuilder()
                .setName('listrooms')
                .setDescription('List all voice channels'),
            
            // Bot Info Commands
            new SlashCommandBuilder()
                .setName('botinfo')
                .setDescription('Show bot information'),
            
            new SlashCommandBuilder()
                .setName('help')
                .setDescription('Show all available commands'),
            
            new SlashCommandBuilder()
                .setName('test')
                .setDescription('Test if slash commands work'),
            
            // Admin Commands
            new SlashCommandBuilder()
                .setName('admin_botlist')
                .setDescription('[ADMIN] List all active bots'),
            
            new SlashCommandBuilder()
                .setName('admin_moveall')
                .setDescription('[ADMIN] Move all bots to a channel')
                .addStringOption(option =>
                    option.setName('channel_name')
                        .setDescription('Voice channel name')
                        .setRequired(true)
                ),
            
            new SlashCommandBuilder()
                .setName('admin_disconnectall')
                .setDescription('[ADMIN] Disconnect all bots'),
            
            new SlashCommandBuilder()
                .setName('admin_forcejoin')
                .setDescription('[ADMIN] Force this bot to join channel')
                .addStringOption(option =>
                    option.setName('channel_name')
                        .setDescription('Voice channel name')
                        .setRequired(true)
                ),
            
            new SlashCommandBuilder()
                .setName('admin_status')
                .setDescription('[ADMIN] Show detailed bot status')
        ];
    }

    async syncSlashCommands() {
        try {
            const rest = new REST({ version: '10' }).setToken(this.client.token);
            
            const commandData = this.commands.map(command => command.toJSON());
            
            // Sync globally
            await rest.put(Routes.applicationCommands(this.client.user.id), {
                body: commandData
            });
            
            console.log(`🔄 Bot #${this.botNumber}: Synced ${commandData.length} slash commands globally`);
            
            // Sync per guild
            for (const guild of this.client.guilds.cache.values()) {
                try {
                    await rest.put(Routes.applicationGuildCommands(this.client.user.id, guild.id), {
                        body: commandData
                    });
                    console.log(`🔄 Bot #${this.botNumber}: Synced commands for guild ${guild.name}`);
                } catch (error) {
                    console.error(`❌ Bot #${this.botNumber}: Failed to sync for guild ${guild.name}:`, error.message);
                }
            }
        } catch (error) {
            console.error(`❌ Bot #${this.botNumber}: Failed to sync slash commands:`, error);
        }
    }

    getMusicPlayer(guildId) {
        if (!this.musicPlayers.has(guildId)) {
            this.musicPlayers.set(guildId, {
                queue: [],
                currentSong: null,
                connection: null,
                player: createAudioPlayer(),
                isPlaying: false,
                volume: 0.5,
                channel: null
            });
        }
        return this.musicPlayers.get(guildId);
    }

    async handleSlashCommand(interaction) {
        const { commandName } = interaction;
        
        switch (commandName) {
            case 'test':
                await interaction.reply({
                    content: `✅ البوت #${this.botNumber} يعمل بشكل صحيح!`,
                    ephemeral: true
                });
                break;
            
            case 'help':
                await this.handleHelpCommand(interaction);
                break;
            
            case 'play':
                await this.handlePlayCommand(interaction);
                break;
            
            case 'joinroom':
                await this.handleJoinRoomCommand(interaction);
                break;
            
            case 'leave':
                await this.handleLeaveCommand(interaction);
                break;
            
            case 'listrooms':
                await this.handleListRoomsCommand(interaction);
                break;
            
            case 'botinfo':
                await this.handleBotInfoCommand(interaction);
                break;
            
            case 'pause':
                await this.handlePauseCommand(interaction);
                break;
            
            case 'resume':
                await this.handleResumeCommand(interaction);
                break;
            
            case 'skip':
                await this.handleSkipCommand(interaction);
                break;
            
            case 'stop':
                await this.handleStopCommand(interaction);
                break;
            
            case 'queue':
                await this.handleQueueCommand(interaction);
                break;
            
            case 'nowplaying':
                await this.handleNowPlayingCommand(interaction);
                break;
            
            case 'volume':
                await this.handleVolumeCommand(interaction);
                break;
            
            // Admin Commands
            case 'admin_botlist':
                await this.handleAdminBotListCommand(interaction);
                break;
            
            case 'admin_status':
                await this.handleAdminStatusCommand(interaction);
                break;
            
            case 'admin_forcejoin':
                await this.handleAdminForceJoinCommand(interaction);
                break;
            
            default:
                await interaction.reply({
                    content: '❌ أمر غير معروف!',
                    ephemeral: true
                });
        }
    }

    async handleHelpCommand(interaction) {
        const embed = new EmbedBuilder()
            .setColor('#0099FF')
            .setTitle(`🎵 Bot #${this.botNumber} - قائمة الأوامر`)
            .setDescription('جميع الأوامر المتاحة:')
            .addFields(
                {
                    name: '🎵 أوامر الموسيقى',
                    value: '`/play` - تشغيل موسيقى من يوتيوب\n`/pause` - إيقاف مؤقت\n`/resume` - استكمال التشغيل\n`/skip` - تخطي الأغنية\n`/stop` - إيقاف وحذف القائمة\n`/queue` - عرض قائمة الانتظار\n`/nowplaying` - الأغنية الحالية\n`/volume` - تغيير مستوى الصوت',
                    inline: false
                },
                {
                    name: '🤖 أوامر التحكم',
                    value: '`/joinroom` - الانضمام لغرفة صوتية\n`/leave` - مغادرة الغرفة الصوتية\n`/listrooms` - عرض الغرف الصوتية\n`/botinfo` - معلومات البوت',
                    inline: false
                }
            )
            .setFooter({ text: `البوت #${this.botNumber} • يعمل 24/7 • استخدم / لرؤية الأوامر` });
        
        if (interaction.memberPermissions?.has('Administrator')) {
            embed.addFields({
                name: '🔧 أوامر الإدارة',
                value: '`/admin_botlist` - قائمة البوتات\n`/admin_status` - حالة تفصيلية\n`/admin_forcejoin` - إجبار البوت على الدخول',
                inline: false
            });
        }
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    async handlePlayCommand(interaction) {
        await interaction.deferReply();
        
        const query = interaction.options.getString('query');
        const member = interaction.member;
        
        if (!member.voice.channel) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ خطأ')
                .setDescription('يجب أن تكون في غرفة صوتية لتشغيل الموسيقى!')
                .setFooter({ text: `البوت #${this.botNumber}` });
            
            await interaction.editReply({ embeds: [embed] });
            return;
        }
        
        try {
            const musicPlayer = this.getMusicPlayer(interaction.guildId);
            
            // Join voice channel if not connected
            if (!musicPlayer.connection) {
                await this.connectToVoice(member.voice.channel, musicPlayer);
            }
            
            // Search for song
            let songUrl = query;
            let songInfo;
            
            if (!ytdl.validateURL(query)) {
                const searchResults = await YouTubeSearchAPI.GetListByKeyword(query, false, 1);
                if (searchResults.items.length === 0) {
                    throw new Error('لم يتم العثور على نتائج');
                }
                songUrl = `https://www.youtube.com/watch?v=${searchResults.items[0].id}`;
            }
            
            // Get song info
            songInfo = await ytdl.getInfo(songUrl);
            
            const song = {
                title: songInfo.videoDetails.title,
                url: songUrl,
                duration: songInfo.videoDetails.lengthSeconds,
                requester: interaction.user,
                thumbnail: songInfo.videoDetails.thumbnails[0]?.url
            };
            
            musicPlayer.queue.push(song);
            
            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('✅ تم إضافة الأغنية')
                .setDescription(`**${song.title}**`)
                .addFields(
                    { name: 'المدة', value: this.formatDuration(song.duration), inline: true },
                    { name: 'الموضع في القائمة', value: `${musicPlayer.queue.length}`, inline: true },
                    { name: 'طالب التشغيل', value: interaction.user.toString(), inline: true }
                )
                .setFooter({ text: `البوت #${this.botNumber}` });
            
            if (song.thumbnail) {
                embed.setThumbnail(song.thumbnail);
            }
            
            await interaction.editReply({ embeds: [embed] });
            
            // Start playing if not already playing
            if (!musicPlayer.isPlaying) {
                await this.playNext(musicPlayer);
            }
            
        } catch (error) {
            console.error('Play command error:', error);
            
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ خطأ')
                .setDescription('فشل في تشغيل الأغنية. تحقق من الرابط أو حاول مرة أخرى.')
                .setFooter({ text: `البوت #${this.botNumber}` });
            
            await interaction.editReply({ embeds: [embed] });
        }
    }

    async connectToVoice(voiceChannel, musicPlayer) {
        try {
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            });
            
            connection.on(VoiceConnectionStatus.Ready, () => {
                console.log(`🎵 Bot #${this.botNumber} connected to voice channel: ${voiceChannel.name}`);
            });
            
            connection.on(VoiceConnectionStatus.Disconnected, () => {
                console.log(`🔌 Bot #${this.botNumber} disconnected from voice`);
                // Auto-reconnect logic can be added here
            });
            
            connection.subscribe(musicPlayer.player);
            musicPlayer.connection = connection;
            musicPlayer.channel = voiceChannel;
            
            // Keep-alive mechanism
            this.startKeepAlive(musicPlayer);
            
        } catch (error) {
            console.error('Voice connection error:', error);
            throw error;
        }
    }

    async playNext(musicPlayer) {
        if (musicPlayer.queue.length === 0) {
            musicPlayer.isPlaying = false;
            musicPlayer.currentSong = null;
            console.log(`🎵 Bot #${this.botNumber}: Queue empty, staying connected`);
            return;
        }
        
        const song = musicPlayer.queue.shift();
        musicPlayer.currentSong = song;
        musicPlayer.isPlaying = true;
        
        try {
            const stream = ytdl(song.url, {
                filter: 'audioonly',
                quality: 'highestaudio',
                highWaterMark: 1 << 25
            });
            
            const resource = createAudioResource(stream, {
                inputType: 'webm/opus'
            });
            
            musicPlayer.player.play(resource);
            
            musicPlayer.player.once(AudioPlayerStatus.Playing, () => {
                console.log(`▶️ Bot #${this.botNumber} now playing: ${song.title}`);
            });
            
            musicPlayer.player.once(AudioPlayerStatus.Idle, () => {
                this.playNext(musicPlayer);
            });
            
        } catch (error) {
            console.error('Playback error:', error);
            musicPlayer.isPlaying = false;
            await this.playNext(musicPlayer);
        }
    }

    startKeepAlive(musicPlayer) {
        if (musicPlayer.keepAliveInterval) return;
        
        musicPlayer.keepAliveInterval = setInterval(() => {
            if (!musicPlayer.connection || musicPlayer.connection.state.status === VoiceConnectionStatus.Destroyed) {
                clearInterval(musicPlayer.keepAliveInterval);
                musicPlayer.keepAliveInterval = null;
                return;
            }
            
            // Keep connection alive - no action needed, just checking
            console.log(`💓 Bot #${this.botNumber}: Keep-alive check`);
        }, 30000); // Every 30 seconds
    }

    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
        }
    }

    async handleJoinRoomCommand(interaction) {
        const channelName = interaction.options.getString('channel_name');
        const voiceChannel = interaction.guild.channels.cache
            .filter(ch => ch.type === 2) // Voice channels
            .find(ch => ch.name.toLowerCase().includes(channelName.toLowerCase()));
        
        if (!voiceChannel) {
            const availableChannels = interaction.guild.channels.cache
                .filter(ch => ch.type === 2)
                .map(ch => ch.name)
                .slice(0, 5)
                .join(', ');
            
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ لم يتم العثور على الغرفة')
                .setDescription(`الغرف المتاحة: ${availableChannels}`)
                .setFooter({ text: `البوت #${this.botNumber}` });
            
            await interaction.reply({ embeds: [embed], ephemeral: true });
            return;
        }
        
        try {
            const musicPlayer = this.getMusicPlayer(interaction.guildId);
            await this.connectToVoice(voiceChannel, musicPlayer);
            
            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('🎵 تم الانضمام للغرفة الصوتية')
                .setDescription(`متصل بـ: **${voiceChannel.name}**`)
                .addFields(
                    { name: 'الأعضاء', value: `${voiceChannel.members.size} شخص`, inline: true },
                    { name: 'رقم البوت', value: `#${this.botNumber}`, inline: true },
                    { name: 'وضع 24/7', value: '✅ سيبقى متصل', inline: true }
                )
                .setFooter({ text: 'البوت سيبقى في الغرفة حتى تستخدم /leave!' });
            
            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Join room error:', error);
            
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ فشل الانضمام')
                .setDescription('لم أتمكن من الانضمام للغرفة الصوتية.')
                .setFooter({ text: `البوت #${this.botNumber}` });
            
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }

    async handleLeaveCommand(interaction) {
        const musicPlayer = this.musicPlayers.get(interaction.guildId);
        
        if (!musicPlayer || !musicPlayer.connection) {
            await interaction.reply({
                content: '❌ لست متصل بأي غرفة صوتية!',
                ephemeral: true
            });
            return;
        }
        
        const channelName = musicPlayer.channel?.name || 'غير معروف';
        
        // Stop music and clear queue
        musicPlayer.queue = [];
        musicPlayer.currentSong = null;
        musicPlayer.isPlaying = false;
        
        // Clear keep-alive
        if (musicPlayer.keepAliveInterval) {
            clearInterval(musicPlayer.keepAliveInterval);
            musicPlayer.keepAliveInterval = null;
        }
        
        // Disconnect
        musicPlayer.connection.destroy();
        musicPlayer.connection = null;
        
        const embed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('👋 تم قطع الاتصال')
            .setDescription(`غادرت الغرفة الصوتية: **${channelName}**\n\n**استخدم \`/joinroom\` للاتصال مرة أخرى**`)
            .setFooter({ text: `البوت #${this.botNumber} • يخرج فقط عندما تطلب ذلك!` });
        
        await interaction.reply({ embeds: [embed] });
    }

    // Add other command handlers...
    async handleListRoomsCommand(interaction) {
        const voiceChannels = interaction.guild.channels.cache
            .filter(ch => ch.type === 2)
            .sort((a, b) => a.position - b.position)
            .first(10);
        
        if (voiceChannels.size === 0) {
            await interaction.reply({
                content: '❌ لا توجد غرف صوتية في هذا السيرفر!',
                ephemeral: true
            });
            return;
        }
        
        const embed = new EmbedBuilder()
            .setColor('#0099FF')
            .setTitle('🎙️ الغرف الصوتية المتاحة')
            .setDescription('الغرف الصوتية في السيرفر:')
            .setFooter({ text: `البوت #${this.botNumber} • استخدم /joinroom [اسم_الغرفة] للانضمام` });
        
        voiceChannels.forEach(channel => {
            const memberCount = channel.members.size;
            const status = `👥 ${memberCount} أعضاء`;
            embed.addFields({ name: channel.name, value: status, inline: true });
        });
        
        await interaction.reply({ embeds: [embed] });
    }

    async handleBotInfoCommand(interaction) {
        const embed = new EmbedBuilder()
            .setColor('#9932CC')
            .setTitle(`🤖 معلومات البوت #${this.botNumber}`)
            .setDescription('نظام موسيقى Discord متقدم')
            .addFields(
                { name: 'اسم البوت', value: this.client.user.tag, inline: true },
                { name: 'رقم البوت', value: `#${this.botNumber}`, inline: true },
                { name: 'Ping', value: `${this.client.ws.ping}ms`, inline: true },
                { name: 'السيرفرات', value: `${this.client.guilds.cache.size}`, inline: true },
                { name: 'وضع 24/7', value: '✅ نشط', inline: true },
                { name: 'إجمالي البوتات', value: '16 بوت', inline: true }
            )
            .setThumbnail(this.client.user.displayAvatarURL())
            .setFooter({ text: 'نظام 16-Bot للموسيقى • يعمل 24/7' })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    }

    // Add pause, resume, skip, stop, queue, nowplaying, volume handlers...
    async handlePauseCommand(interaction) {
        const musicPlayer = this.musicPlayers.get(interaction.guildId);
        
        if (!musicPlayer || !musicPlayer.isPlaying) {
            await interaction.reply({
                content: '❌ لا توجد موسيقى قيد التشغيل!',
                ephemeral: true
            });
            return;
        }
        
        musicPlayer.player.pause();
        
        const embed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('⏸️ تم إيقاف الموسيقى مؤقتاً')
            .setDescription('استخدم `/resume` لمتابعة التشغيل')
            .setFooter({ text: `البوت #${this.botNumber}` });
        
        await interaction.reply({ embeds: [embed] });
    }

    async handleResumeCommand(interaction) {
        const musicPlayer = this.musicPlayers.get(interaction.guildId);
        
        if (!musicPlayer) {
            await interaction.reply({
                content: '❌ لا توجد موسيقى متوقفة!',
                ephemeral: true
            });
            return;
        }
        
        musicPlayer.player.unpause();
        
        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('▶️ تم استكمال التشغيل')
            .setDescription('الموسيقى تعمل الآن')
            .setFooter({ text: `البوت #${this.botNumber}` });
        
        await interaction.reply({ embeds: [embed] });
    }

    async handleAdminBotListCommand(interaction) {
        if (!interaction.memberPermissions?.has('Administrator')) {
            await interaction.reply({
                content: '❌ هذا الأمر يتطلب صلاحيات الإدارة!',
                ephemeral: true
            });
            return;
        }
        
        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🤖 قائمة البوتات النشطة')
            .setDescription('جميع البوتات النشطة في السيرفر')
            .setFooter({ text: 'نظام 16-Bot • بيانات حية' });
        
        // Get all bot members
        const botMembers = interaction.guild.members.cache.filter(member => 
            member.user.bot && (member.user.username.includes('support') || member.user.username.includes('DEVIL'))
        );
        
        if (botMembers.size > 0) {
            botMembers.forEach(bot => {
                const status = bot.presence?.status === 'offline' ? '🔴 غير متصل' : '🟢 متصل';
                const voiceStatus = bot.voice.channel ? `في: ${bot.voice.channel.name}` : 'ليس في غرفة صوتية';
                
                embed.addFields({
                    name: bot.user.username,
                    value: `${status}\n${voiceStatus}`,
                    inline: true
                });
            });
        } else {
            embed.setDescription('لم يتم العثور على بوتات موسيقى في السيرفر');
        }
        
        await interaction.reply({ embeds: [embed] });
    }

    async handleAdminStatusCommand(interaction) {
        if (!interaction.memberPermissions?.has('Administrator')) {
            await interaction.reply({
                content: '❌ هذا الأمر يتطلب صلاحيات الإدارة!',
                ephemeral: true
            });
            return;
        }
        
        const musicPlayer = this.musicPlayers.get(interaction.guildId);
        
        const embed = new EmbedBuilder()
            .setColor('#FF8C00')
            .setTitle(`🔧 حالة البوت #${this.botNumber} - للإدارة`)
            .addFields(
                { name: 'اسم البوت', value: this.client.user.tag, inline: true },
                { name: 'رقم البوت', value: `#${this.botNumber}`, inline: true },
                { name: 'Ping', value: `${this.client.ws.ping}ms`, inline: true }
            );
        
        if (musicPlayer && musicPlayer.connection) {
            embed.addFields(
                { name: 'الغرفة الصوتية', value: musicPlayer.channel?.name || 'غير معروف', inline: true },
                { name: 'حالة الصوت', value: '🟢 متصل', inline: true }
            );
        } else {
            embed.addFields({ name: 'حالة الصوت', value: '🔴 غير متصل', inline: true });
        }
        
        if (musicPlayer?.currentSong) {
            embed.addFields({
                name: 'الأغنية الحالية',
                value: musicPlayer.currentSong.title.substring(0, 50),
                inline: false
            });
        }
        
        const queueSize = musicPlayer?.queue?.length || 0;
        embed.addFields({ name: 'حجم القائمة', value: `${queueSize} أغنية`, inline: true });
        
        await interaction.reply({ embeds: [embed] });
    }

    async handleAdminForceJoinCommand(interaction) {
        if (!interaction.memberPermissions?.has('Administrator')) {
            await interaction.reply({
                content: '❌ هذا الأمر يتطلب صلاحيات الإدارة!',
                ephemeral: true
            });
            return;
        }
        
        const channelName = interaction.options.getString('channel_name');
        const voiceChannel = interaction.guild.channels.cache
            .filter(ch => ch.type === 2)
            .find(ch => ch.name.toLowerCase().includes(channelName.toLowerCase()));
        
        if (!voiceChannel) {
            const availableChannels = interaction.guild.channels.cache
                .filter(ch => ch.type === 2)
                .map(ch => ch.name)
                .slice(0, 5)
                .join(', ');
            
            await interaction.reply({
                content: `❌ لم يتم العثور على الغرفة '${channelName}'!\nالغرف المتاحة: ${availableChannels}`,
                ephemeral: true
            });
            return;
        }
        
        try {
            const musicPlayer = this.getMusicPlayer(interaction.guildId);
            await this.connectToVoice(voiceChannel, musicPlayer);
            
            await interaction.reply({
                content: `✅ البوت #${this.botNumber} انضم إجبارياً إلى: **${voiceChannel.name}**`
            });
        } catch (error) {
            console.error('Force join error:', error);
            await interaction.reply({
                content: `❌ فشل الانضمام: ${error.message}`,
                ephemeral: true
            });
        }
    }

    async start(token) {
        try {
            await this.client.login(token);
        } catch (error) {
            console.error(`❌ Failed to start Bot #${this.botNumber}:`, error);
            throw error;
        }
    }
}

module.exports = MusicBot;
