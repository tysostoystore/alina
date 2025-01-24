// Near the top of your file
if (!window.splToken && window.spl_token) {
    window.splToken = window.spl_token;
}

// Constants
const ALINA_TOKEN_ADDRESS = 'DE49vWtUWZYGWxr6UVP1grRF6Cqya5YMs3FFiu7Bpump';
const ALINA_FOUNDATION_WALLET = 'FTJocVcf3TiMXnV3Syfi51QAno3oqWVfTCRUWmn4qtYE';
const REQUIRED_TOKEN_AMOUNT = 100000;

const RPC_ENDPOINTS = [
    'https://mainnet.helius-rpc.com/?api-key=69d864e8-5015-4a83-8010-add4dfcdcd56',
    'https://rpc.helius.xyz/?api-key=69d864e8-5015-4a83-8010-add4dfcdcd56',
    'https://solana-mainnet.rpc.extrnode.com',
    'https://solana.getblock.io/mainnet/'
];

// Initialize connection
let connection;

async function getWorkingConnection() {
    for (const endpoint of RPC_ENDPOINTS) {
        try {
            const conn = new solanaWeb3.Connection(endpoint, {
                commitment: 'confirmed',
                confirmTransactionInitialTimeout: 60000,
                fetch: async (url, options) => {
                    const response = await fetch(url, {
                        ...options,
                        headers: {
                            'Content-Type': 'application/json',
                        }
                    });
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response;
                }
            });
            
            await conn.getSlot();
            console.log(`Connected to ${endpoint}`);
            return conn;
        } catch (e) {
            console.warn(`Failed to connect to ${endpoint}:`, e.message);
        }
    }
    throw new Error('Failed to connect to any RPC endpoint');
}

async function initializeConnection(retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            connection = await getWorkingConnection();
            return;
        } catch (error) {
            console.error(`Connection attempt ${i + 1} failed:`, error);
            if (i === retries - 1) {
                showMessage('Network connection error. Please try again later.', 'error');
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

// Initialize connection immediately
(async () => {
    try {
        await initializeConnection();
    } catch (error) {
        console.error('Failed to initialize connection:', error);
    }
})();

// Artwork data
const artworks = [
    {
        id: 1,
        title: "Alina the Dolphin",
        artist: "Alina, 7",
        price: "1M $ALINA",
        image: "./assets/arts/og.jpg",
        type: "featured"
    },
    {
        id: 2,
        title: "Ocean Dreams",
        artist: "Alina, 7",
        price: "500k $ALINA",
        image: "./assets/arts/art2.jpg",
        type: "featured"
    },
    {
        id: 3,
        title: "Starry Night",
        artist: "Alina, 7",
        price: "750k $ALINA",
        image: "./assets/arts/starry_night.png",
        type: "recent"
    },
    {
        id: 4,
        title: "Seagulls",
        artist: "Alina, 7",
        price: "300k $ALINA",
        image: "./assets/arts/seagulls.png",
        type: "recent"
    },
    {
        id: 5,
        title: "Saigam",
        artist: "Alina, 7",
        price: "600k $ALINA",
        image: "./assets/arts/saigam.png",
        type: "recent"
    },
    {
        id: 6,
        title: "Fancy Creatures",
        artist: "Alina, 7",
        price: "120k $ALINA",
        image: "./assets/arts/creatures.png",
        type: "recent"
    },
    {
        id: 7,
        title: "Yemen",
        artist: "Alina, 7",
        price: "90k $ALINA",
        image: "./assets/arts/yemen.png",
        type: "recent"
    },
    {
        id: 8,
        title: "The Flight",
        artist: "Alina, 7",
        price: "700k $ALINA",
        image: "./assets/arts/flight.png",
        type: "recent"
    }
];

class WalletManager {
    constructor() {
        this.wallet = null;
        this.balance = 0;
        this.tokenBalance = 0;
        this.transactions = [];
        this.init();
    }

    init() {
        if (window.solana) {
            window.solana.on('connect', () => this.handleConnect());
            window.solana.on('disconnect', () => this.handleDisconnect());
            window.solana.on('accountChanged', () => this.handleAccountChanged());
        }
    }

    async connect() {
        try {
            if (!window.solana?.isPhantom) {
                throw new Error('Please install Phantom wallet');
            }

            const resp = await window.solana.connect();
            if (resp.publicKey) {
                this.wallet = resp.publicKey;
                try {
                    await this.updateBalances();
                } catch (balanceError) {
                    console.warn('Failed to update balances:', balanceError);
                }
                return true;
            }
            throw new Error('Failed to connect wallet');
        } catch (error) {
            console.error('Wallet connection error:', error);
            throw error;
        }
    }

    async disconnect() {
        if (window.solana) {
            try {
                await window.solana.disconnect();
                this.wallet = null;
                this.balance = 0;
                this.tokenBalance = 0;
                this.updateUI();
            } catch (error) {
                console.error('Disconnect error:', error);
            }
        }
    }

    async updateBalances() {
        if (!this.wallet || !connection) return;

        try {
            let retries = 3;
            while (retries > 0) {
                try {
                    this.balance = await connection.getBalance(this.wallet);
                    break;
                } catch (error) {
                    retries--;
                    if (retries === 0) throw error;
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    connection = await getWorkingConnection();
                }
            }

            const tokenAccount = await this.findTokenAccount();
            if (tokenAccount) {
                const accountInfo = await connection.getParsedAccountInfo(tokenAccount);
                if (accountInfo?.value?.data?.parsed?.info?.tokenAmount) {
                    this.tokenBalance = accountInfo.value.data.parsed.info.tokenAmount.uiAmount;
                }
            }

            this.updateUI();
        } catch (error) {
            console.error('Balance update error:', error);
            this.balance = 0;
            this.tokenBalance = 0;
            this.updateUI();
        }
    }

    async findTokenAccount() {
        if (!connection) return null;
        
        try {
            const tokenMint = new solanaWeb3.PublicKey(ALINA_TOKEN_ADDRESS);
            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
                this.wallet,
                { mint: tokenMint }
            );
            return tokenAccounts.value[0]?.pubkey;
        } catch (error) {
            console.error('Token account error:', error);
            return null;
        }
    }

    async donate(amount) {
        if (!this.wallet) throw new Error('Please connect your wallet');
        if (!connection) throw new Error('No connection available');
        
        try {
            console.log('Starting SOL donation process...');
            
            // Convert amount to lamports and ensure it's an integer
            const lamports = Math.round(amount * solanaWeb3.LAMPORTS_PER_SOL);
            
            console.log('Creating transaction for', lamports, 'lamports');
            
            // Create transaction
            const transaction = new solanaWeb3.Transaction().add(
                solanaWeb3.SystemProgram.transfer({
                    fromPubkey: this.wallet,
                    toPubkey: new solanaWeb3.PublicKey(ALINA_FOUNDATION_WALLET),
                    lamports: lamports
                })
            );
    
            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = this.wallet;
    
            console.log('Sending transaction...');
            const signature = await window.solana.signAndSendTransaction(transaction);
            console.log('Transaction sent:', signature.signature);
    
            const confirmation = await connection.confirmTransaction(signature.signature);
            console.log('Transaction confirmed:', confirmation);
            
            await this.updateBalances();
            showMessage('Thank you for your donation!');
            return signature.signature;
        } catch (error) {
            console.error('Donation error:', error);
            showMessage('Donation failed: ' + error.message, 'error');
            throw error;
        }
    }

    updateUI() {
        const walletBtn = document.querySelector('.wallet-btn');
        if (walletBtn) {
            if (this.wallet) {
                const addressString = this.wallet.toString();
                walletBtn.textContent = `${addressString.slice(0, 4)}...${addressString.slice(-4)}`;
                walletBtn.classList.add('connected');
            } else {
                walletBtn.textContent = 'Connect Wallet';
                walletBtn.classList.remove('connected');
            }
        }

        const balanceElement = document.getElementById('balance');
        if (balanceElement) {
            balanceElement.textContent = `${(this.balance / solanaWeb3.LAMPORTS_PER_SOL).toFixed(4)} SOL`;
        }

        const tokenBalanceElement = document.getElementById('token-balance');
        if (tokenBalanceElement) {
            tokenBalanceElement.textContent = `${this.tokenBalance.toFixed(0)} $ALINA`;
        }
    }

    handleConnect() {
        this.updateBalances();
    }

    handleDisconnect() {
        this.wallet = null;
        this.updateUI();
    }

    handleAccountChanged() {
        this.updateBalances();
    }
}

// Initialize wallet manager
const walletManager = new WalletManager();

// Gallery functionality
function populateGallery(filter = 'all') {
    const gallery = document.querySelector('.gallery-grid');
    if (!gallery) return;
    
    gallery.innerHTML = '';
    
    const filteredArt = filter === 'all' 
        ? artworks 
        : artworks.filter(art => art.type === filter);

    filteredArt.forEach(art => {
        gallery.innerHTML += `
            <div class="art-card">
                <img src="${art.image}" alt="${art.title}" class="art-image">
                <div class="art-card-content">
                    <h3 class="art-title">${art.title}</h3>
                    <p class="art-artist">By ${art.artist}</p>
                    <p class="art-price-info">Max bid:</p>
                    <div class="art-price">${art.price}</div>
                    <button class="bid-button" onclick="bidArtwork(${art.id})">Bid</button>
                </div>
            </div>
        `;
    });
}

// Popup functionality
function openPopup(popupId) {
    const popup = document.getElementById(popupId);
    if (popup) {
        popup.style.display = 'flex';
        void popup.offsetWidth;
        popup.classList.add('active');
    }
}

function closePopup(popupId) {
    const popup = document.getElementById(popupId);
    if (popup) {
        popup.classList.remove('active');
        setTimeout(() => {
            popup.style.display = 'none';
        }, 300);
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    populateGallery();
    
    document.querySelectorAll('.gallery-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons
            document.querySelectorAll('.gallery-btn').forEach(b => 
                b.classList.remove('active')
            );
            
            // Add active class to clicked button
            btn.classList.add('active');
            
            // Get filter value and update gallery
            const filter = btn.dataset.filter;
            populateGallery(filter);
            
            // Scroll to gallery section
            const gallerySection = document.getElementById('gallery');
            if (gallerySection) {
                gallerySection.scrollIntoView({ 
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = btn.dataset.scroll;
            const section = document.getElementById(sectionId);
            if (section) {
                section.scrollIntoView({ 
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    document.querySelectorAll('.help-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const helpType = btn.dataset.type;
            const helpTypeSelect = document.getElementById('helpType');
            if (helpTypeSelect) {
                helpTypeSelect.value = helpType;
            }
            openPopup('help-form-popup');
        });
    });

    const donateBtn = document.querySelector('.donate-btn');
    donateBtn?.addEventListener('click', async () => {
        try {
            console.log('Donate button clicked');
            if (!walletManager.wallet) {
                console.log('Connecting wallet...');
                await walletManager.connect();
            }
            
            const amount = prompt('Enter amount to donate ($ALINA):');
            console.log('Amount entered:', amount);
            
            if (amount && !isNaN(amount)) {
                showMessage('Processing donation...', 'info');
                const txSignature = await walletManager.donate(parseFloat(amount));
                console.log('Transaction completed:', txSignature);
            } else {
                console.log('Invalid amount or cancelled');
            }
        } catch (error) {
            console.error('Donation failed:', error);
            showMessage('Donation failed: ' + error.message, 'error');
        }
    });

    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const popupId = btn.closest('.popup').id;
            closePopup(popupId);
        });
    });

    // Update the bid button handlers
    document.querySelectorAll('.bid-button').forEach(btn => {
        btn.addEventListener('click', () => {
            openModal('auction-modal');
        });
    });

    // Modal functions
    function openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
        }
    }

    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
    }

    // Close button handler
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal');
            if (modal) {
                closeModal(modal.id);
            }
        });
    });

    // Click outside to close
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });
});

function showMessage(message, type = 'success') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}

window.walletManager = walletManager;