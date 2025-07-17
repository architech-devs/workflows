import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/architech';

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    profileImage: {
        type: String,
        default: null
    },
    resetPasswordCode: {
        type: String,
        default: undefined
    },
    resetPasswordExpires: {
        type: Date,
        default: undefined
    },
    githubToken: {
        type: String,
        default: null
    },
    githubUsername: {
        type: String,
        default: null
    },
    githubTokenExpiresAt: {
        type: Date,
        default: null
    },
    pinnedChats: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Chat',
        default: []
    }],
    dailyLimit: {
        type: Number,
        default: 10
    },
    creditsUsedToday: {
        type: Number,
        default: 0
    },
    creditsLastReset: {
        type: Date,
        default: Date.now
    },
    creditHistory: {
        type: Map,
        of: Number,
        default: new Map()
    }
}, {
    timestamps: true
});

const User = mongoose.model('User', userSchema);

function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${year}-${month}-${day}`;
}

function getDate40DaysAgo() {
    const date = new Date();
    date.setDate(date.getDate() - 40);
    return formatDate(date);
}

async function processCreditReset() {
    try {
        console.log('🔄 Starting daily credit reset process...');
        
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB');

        const users = await User.find({});

        const today = formatDate(new Date());
        const date40DaysAgo = getDate40DaysAgo();
        let processedCount = 0;
        let errorCount = 0;

        for (const user of users) {
            try {
                const creditHistory = user.creditHistory || new Map();
                
                const creditsUsedToday = user.creditsUsedToday || 0;
                creditHistory.set(today, creditsUsedToday);

                const entriesToRemove = [];
                for (const [date, _] of creditHistory.entries()) {
                    if (date === date40DaysAgo) {
                        entriesToRemove.push(date);
                    }
                }
                
                for (const date of entriesToRemove) {
                    creditHistory.delete(date);
                }

                await User.findByIdAndUpdate(user._id, {
                    creditHistory: creditHistory,
                    creditsUsedToday: 0,
                    dailyLimit: 10,
                    creditsLastReset: new Date()
                });

                processedCount++;
                
                if (processedCount % 100 === 0) {
                    console.log(`✅ Processed all users...`);
                }

            } catch (error) {
                console.error(`❌ Error processing user ${user._id}:`, error.message);
                errorCount++;
            }
        }

        console.log(`✅ Credit reset completed!`);
        console.log(`📊 Summary:`);
        console.log(`   - Errors: ${errorCount}`);
        console.log(`   - Date processed: ${today}`);

        // Close MongoDB connection
        await mongoose.connection.close();
        console.log('🔌 MongoDB connection closed');

    } catch (error) {
        console.error('❌ Fatal error in credit reset process:', error);
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
        }
        throw error;
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const authToken = req.headers['x-auth-token'];
    if (!authToken || authToken !== process.env.CRON_SECRET_TOKEN) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        await processCreditReset();
        res.status(200).json({ 
            success: true, 
            message: 'Credit reset completed successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Cron job failed:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Credit reset failed',
            message: error.message
        });
    }
}

if (process.env.NODE_ENV === 'development') {
    processCreditReset()
        .then(() => {
            console.log('✅ Local test completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Local test failed:', error);
            process.exit(1);
        });
}
