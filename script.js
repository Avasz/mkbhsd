const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game Constants
const GRAVITY = 0.6;
const JUMP_STRENGTH = -12; // Negative because Y goes down
let GROUND_HEIGHT = 50;
const BASE_GAME_HEIGHT = 400;
const BASE_GROUND_HEIGHT = 50;

// Game State
let gameRunning = false;
let score = 0;
let gameSpeed = 5;
let frameCount = 0;
let obstacles = [];
let animationId;
let spawnTimer = 0;

// Assets
const spritePaths = ['assets/1.png', 'assets/2.png', 'assets/3.png'];
const playerSprites = [];
const processedSprites = [];

// Function to remove white background
function removeWhiteBackground(img) {
    try {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(img, 0, 0);

        const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            // If pixel is near white
            if (r > 240 && g > 240 && b > 240) {
                data[i + 3] = 0; // Set alpha to 0 (transparent)
            }
        }

        tempCtx.putImageData(imageData, 0, 0);
        const newImg = new Image();
        newImg.src = tempCanvas.toDataURL();
        return newImg;
    } catch (e) {
        console.warn("Could not process image transparency (likely CORS):", e);
        return img; // Return original if processing fails
    }
}

// Load and process sprites
spritePaths.forEach((path, index) => {
    const img = new Image();
    img.src = path;
    playerSprites[index] = img;

    img.onload = function () {
        processedSprites[index] = removeWhiteBackground(img);
    };
});

const fireImg = new Image();
fireImg.src = 'assets/fire.png';

// Audio (Placeholders)
const jumpSound = new Audio('assets/jump.mp3'); // Fixed: was gameover.mp3
const hitSound = new Audio('assets/gameover.mp3');
const bgm = new Audio('assets/bgm.mp3');
bgm.loop = true;
bgm.volume = 0.3; // Lower volume as requested

// Audio Context
// Reverting to file-based audio as per user request
function playJumpSound() {
    // Play jump sound on every jump as requested
    if (jumpSound) {
        jumpSound.currentTime = 0; // Reset to start for immediate replay
        jumpSound.play().catch(e => console.log("Jump sound failed", e));
    }
}

function playGameOverSound() {
    // Stop jump sound immediately
    if (jumpSound) {
        jumpSound.pause();
        jumpSound.currentTime = 0;
    }

    // Stop BGM
    if (bgm) {
        bgm.pause();
        bgm.currentTime = 0;
    }

    const gameOverContent = document.getElementById('game-over-content');

    // Play game over sound after a short delay
    setTimeout(() => {
        if (hitSound) {
            hitSound.currentTime = 0;

            // Show content only after audio finishes
            hitSound.onended = function () {
                gameOverContent.classList.remove('hidden');
            };

            // Fallback if audio fails or doesn't play
            hitSound.play().catch(e => {
                console.log("Game over sound failed", e);
                gameOverContent.classList.remove('hidden'); // Show immediately if fail
            });
        } else {
            gameOverContent.classList.remove('hidden');
        }
    }, 500); // 500ms delay
}


const deadImg = new Image();
deadImg.src = 'assets/dead.png';
let processedDeadSprite;

const fireSprites = [];
const fireImages = [];
['assets/fire1.png', 'assets/fire2.png', 'assets/fire3.png'].forEach((path, index) => {
    const img = new Image();
    img.src = path;
    fireImages[index] = img;
    img.onload = function () {
        console.log(`Loaded fire sprite: ${path}`);
        // Use raw image directly since fire sprites already have transparency
        fireSprites[index] = img;
    };
    img.onerror = function () {
        console.error(`Failed to load fire sprite: ${path}`);
        fireSprites[index] = null;
    };
});

deadImg.onload = function () {
    processedDeadSprite = removeWhiteBackground(deadImg);
};

// Player Object
const player = {
    x: 50, // Will be reset in startGame
    y: 0,
    width: 50,
    height: 100,
    dy: 0,
    grounded: false,
    frame: 0,
    animationSpeed: 15, // Slower animation (was 5)
    dead: false,
    rotation: 0,
    fireFrame: 0,

    draw: function () {
        ctx.save();

        if (this.dead) {
            // Fire Animation
            const fireIndex = Math.floor(this.fireFrame / 10) % 3; // Cycle speed
            const fireSprite = fireSprites[fireIndex];

            if (fireSprite && fireSprite.complete && fireSprite.naturalWidth > 0) {
                // Anchor at bottom
                const ratio = fireSprite.naturalWidth / fireSprite.naturalHeight;
                const drawWidth = this.width * 1.5; // Make fire a bit wider
                const drawHeight = drawWidth / ratio;

                // Position: Bottom aligned with player bottom
                const drawX = this.x + (this.width - drawWidth) / 2;
                const drawY = (this.y + this.height) - drawHeight;

                ctx.drawImage(fireSprite, drawX, drawY, drawWidth, drawHeight);
            } else {
                // Fallback to dead sprite if fire animation fails
                if (processedDeadSprite) {
                    ctx.drawImage(processedDeadSprite, this.x, this.y, this.width, this.height);
                } else if (deadImg.complete) {
                    ctx.drawImage(deadImg, this.x, this.y, this.width, this.height);
                } else {
                    ctx.fillStyle = 'orange';
                    ctx.fillRect(this.x, this.y, this.width, this.height);
                }
            }
        } else {
            // Normal drawing
            // Determine current sprite
            let currentSprite;
            if (this.grounded) {
                // Cycle through sprites when running
                const spriteIndex = Math.floor(this.frame / this.animationSpeed) % playerSprites.length;
                currentSprite = processedSprites[spriteIndex] || playerSprites[spriteIndex];
            } else {
                // Use a specific frame for jumping (e.g., the second one)
                currentSprite = processedSprites[1] || playerSprites[1] || processedSprites[0] || playerSprites[0];
            }

            if (currentSprite && currentSprite.complete && currentSprite.naturalHeight !== 0) {
                ctx.drawImage(currentSprite, this.x, this.y, this.width, this.height);
            } else {
                // Fallback rectangle
                ctx.fillStyle = '#333';
                ctx.fillRect(this.x, this.y, this.width, this.height);
            }
        }
        ctx.restore();
    },

    update: function () {
        if (this.dead) {
            this.fireFrame++;
            this.y += this.dy;
            this.dy += GRAVITY;
            // Ground Collision for dead body
            if (this.y + this.height > canvas.height - GROUND_HEIGHT) {
                this.y = canvas.height - GROUND_HEIGHT - this.height;
                this.dy = 0; // Stop bouncing, just burn
            }
            return;
        }

        // Jump
        if (keys['Space'] || keys['ArrowUp'] || touchJump) {
            if (this.grounded) {
                this.dy = JUMP_STRENGTH;
                this.grounded = false;
                playJumpSound();
                jumpCount++; // Increment jump counter for day/night cycle
                touchJump = false; // Reset touch trigger
            }
        }

        this.y += this.dy;
        this.dy += GRAVITY;

        // Ground Collision
        if (this.y + this.height > canvas.height - GROUND_HEIGHT) {
            this.y = canvas.height - GROUND_HEIGHT - this.height;
            this.dy = 0;
            this.grounded = true;
        }

        // Animate
        if (this.grounded) {
            this.frame++;
        }
    }
};

// Obstacle Class
class Obstacle {
    constructor() {
        this.width = 30 + Math.random() * 20;
        this.height = 30 + Math.random() * 30;
        this.x = -this.width; // Spawn on left
        this.y = canvas.height - GROUND_HEIGHT - this.height;
        this.frame = 0;
    }

    update() {
        this.x += gameSpeed; // Move right
        this.frame++;
    }

    draw() {
        if (fireImg.complete && fireImg.naturalHeight !== 0) {
            ctx.drawImage(fireImg, this.x, this.y, this.width, this.height);
        } else {
            // Improved Procedural Fire Animation
            const time = this.frame * 0.2;

            // Base flame
            ctx.fillStyle = `hsl(${10 + Math.random() * 20}, 100%, 50%)`; // Red-Orange
            ctx.beginPath();
            ctx.moveTo(this.x, this.y + this.height);

            // Left curve
            ctx.quadraticCurveTo(
                this.x - 5 + Math.sin(time) * 5,
                this.y + this.height / 2,
                this.x + this.width / 2 + Math.cos(time * 1.5) * 5,
                this.y
            );

            // Right curve
            ctx.quadraticCurveTo(
                this.x + this.width + 5 + Math.sin(time + 1) * 5,
                this.y + this.height / 2,
                this.x + this.width,
                this.y + this.height
            );
            ctx.fill();

            // Inner flame (Yellow-Orange)
            ctx.fillStyle = `hsl(${40 + Math.random() * 20}, 100%, 60%)`;
            ctx.beginPath();
            ctx.moveTo(this.x + 10, this.y + this.height);
            ctx.quadraticCurveTo(
                this.x + 10 + Math.sin(time + 2) * 3,
                this.y + this.height / 2 + 10,
                this.x + this.width / 2 + Math.cos(time * 2) * 3,
                this.y + 15
            );
            ctx.quadraticCurveTo(
                this.x + this.width - 10 + Math.sin(time + 3) * 3,
                this.y + this.height / 2 + 10,
                this.x + this.width - 10,
                this.y + this.height
            );
            ctx.fill();
        }
    }
}

// Cloud Class
class Cloud {
    constructor() {
        this.x = -100 - Math.random() * 200; // Spawn on left
        this.y = Math.random() * (canvas.height / 2);
        this.width = 60 + Math.random() * 40;
        this.height = 30 + Math.random() * 20;
        this.speed = 1 + Math.random() * 1; // Slower than game speed
        this.markedForDeletion = false;
    }

    update() {
        this.x += this.speed; // Move right
        if (this.x > canvas.width) {
            this.markedForDeletion = true;
        }
    }

    draw(isNight) {
        ctx.fillStyle = isNight ? 'rgba(100, 100, 100, 0.8)' : 'rgba(255, 255, 255, 0.8)'; // Darker at night
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.height / 2, Math.PI * 0.5, Math.PI * 1.5);
        ctx.arc(this.x + this.width / 2, this.y - this.height / 2, this.height, Math.PI * 1, Math.PI * 2); // Top hump
        ctx.arc(this.x + this.width, this.y, this.height / 2, Math.PI * 1.5, Math.PI * 0.5);
        ctx.lineTo(this.x, this.y + this.height / 2);
        ctx.fill();
    }
}

// Bird Class
class Bird {
    constructor() {
        this.x = -50 - Math.random() * 200; // Spawn on left
        this.y = Math.random() * (canvas.height / 3);
        this.width = 20;
        this.height = 10;
        this.speed = 2 + Math.random() * 2;
        this.markedForDeletion = false;
        this.frame = 0;
    }

    update() {
        this.x += this.speed; // Move right
        this.frame++;
        if (this.x > canvas.width) {
            this.markedForDeletion = true;
        }
    }

    draw(isNight) {
        ctx.strokeStyle = isNight ? '#ccc' : '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const wingY = Math.sin(this.frame * 0.2) * 5;
        ctx.moveTo(this.x, this.y);
        ctx.quadraticCurveTo(this.x + this.width / 4, this.y - wingY, this.x + this.width / 2, this.y);
        ctx.quadraticCurveTo(this.x + this.width * 0.75, this.y - wingY, this.x + this.width, this.y);
        ctx.stroke();
    }
}

// Underground Item Class
class UndergroundItem {
    constructor() {
        const types = ['worm', 'rock', 'bug', 'rat', 'snake', 'hole', 'water'];
        this.type = types[Math.floor(Math.random() * types.length)];
        this.x = canvas.width + Math.random() * 100;

        const groundTop = canvas.height - GROUND_HEIGHT;
        this.y = groundTop + 20 + Math.random() * (GROUND_HEIGHT - 40);
        this.size = 15 + Math.random() * 20; // Slightly larger base size
        this.frame = 0;
        this.markedForDeletion = false;

        // Parallax factor: 0.5 to 0.8 (slower than game speed)
        this.parallaxFactor = 0.5 + Math.random() * 0.3;

        // Specific properties based on type
        if (this.type === 'rock') {
            this.color = '#555';
        } else if (this.type === 'worm') {
            this.color = '#ff9999';
        } else if (this.type === 'bug') {
            this.color = '#222';
        } else if (this.type === 'rat') {
            this.color = '#808080';
        } else if (this.type === 'snake') {
            this.color = '#228B22';
        } else if (this.type === 'hole') {
            this.color = '#2a1505'; // Darker than ground
        } else if (this.type === 'water') {
            this.color = 'rgba(0, 100, 255, 0.6)';
        }
    }

    update() {
        this.x -= gameSpeed * this.parallaxFactor; // Move slower than ground
        this.frame++;
        if (this.x < -100) {
            this.markedForDeletion = true;
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);

        if (this.type === 'worm') {
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            // Slower animation: frame * 0.05
            for (let i = 0; i < this.size; i += 2) {
                ctx.lineTo(i, Math.sin((this.frame * 0.05) + (i * 0.5)) * 3);
            }
            ctx.stroke();
        } else if (this.type === 'rock') {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
            ctx.fill();
            // Highlight
            ctx.fillStyle = '#777';
            ctx.beginPath();
            ctx.arc(-2, -2, this.size / 4, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'bug') {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.ellipse(0, 0, this.size / 3, this.size / 4, 0, 0, Math.PI * 2);
            ctx.fill();
            // Legs
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.beginPath();
            // Left legs
            ctx.moveTo(-5, 0); ctx.lineTo(-8, -3);
            ctx.moveTo(-5, 0); ctx.lineTo(-8, 3);
            // Right legs
            ctx.moveTo(5, 0); ctx.lineTo(8, -3);
            ctx.moveTo(5, 0); ctx.lineTo(8, 3);
            ctx.stroke();
        } else if (this.type === 'rat') {
            // Body
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.ellipse(0, 0, this.size / 2, this.size / 3, 0, 0, Math.PI * 2);
            ctx.fill();
            // Tail - Slower animation: frame * 0.1
            ctx.strokeStyle = 'pink';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(this.size / 2, 0);
            ctx.quadraticCurveTo(this.size, Math.sin(this.frame * 0.1) * 5, this.size + 10, 0);
            ctx.stroke();
            // Ear
            ctx.fillStyle = 'pink';
            ctx.beginPath();
            ctx.arc(-this.size / 3, -this.size / 4, 3, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'snake') {
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.beginPath();
            // Slower animation: frame * 0.05
            for (let i = 0; i < this.size * 1.5; i += 3) {
                ctx.lineTo(i - this.size / 2, Math.sin((this.frame * 0.05) + (i * 0.3)) * 4);
            }
            ctx.stroke();
            // Tongue - Slower flick
            if (Math.floor(this.frame / 20) % 2 === 0) {
                ctx.strokeStyle = 'red';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(-this.size / 2, 0);
                ctx.lineTo(-this.size / 2 - 5, 0);
                ctx.stroke();
            }
        } else if (this.type === 'hole') {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.ellipse(0, 0, this.size, this.size / 2, 0, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'water') {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.ellipse(0, 0, this.size * 1.5, this.size / 2, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

let clouds = [];
let birds = [];
let undergroundItems = [];
let jumpCount = 0;

function handleBackgroundElements(isNight) {
    // Clouds
    if (Math.random() < 0.01) {
        clouds.push(new Cloud());
    }
    clouds.forEach(cloud => {
        cloud.update();
        cloud.draw(isNight);
    });
    clouds = clouds.filter(cloud => !cloud.markedForDeletion);

    // Birds
    if (Math.random() < 0.005) {
        birds.push(new Bird());
    }
    birds.forEach(bird => {
        bird.update();
        bird.draw(isNight);
    });
    birds = birds.filter(bird => !bird.markedForDeletion);
}

function drawCelestialBody(isNight) {
    const x = (frameCount * 0.5) % (canvas.width + 100) - 50; // Parallax movement
    const y = 50;

    if (isNight) {
        // Moon
        ctx.fillStyle = '#F4F6F0';
        ctx.beginPath();
        ctx.arc(x, y, 30, 0, Math.PI * 2);
        ctx.fill();
        // Crater
        ctx.fillStyle = '#E0E0E0';
        ctx.beginPath();
        ctx.arc(x - 10, y + 5, 5, 0, Math.PI * 2);
        ctx.fill();
    } else {
        // Sun
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(x, y, 40, 0, Math.PI * 2);
        ctx.fill();
        // Rays
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(x + Math.cos(angle) * 50, y + Math.sin(angle) * 50);
            ctx.lineTo(x + Math.cos(angle) * 70, y + Math.sin(angle) * 70);
            ctx.stroke();
        }
    }
}

function drawBackground() {
    const isNight = jumpCount % 30 >= 15; // Cycle every 15 jumps (approx)

    // Sky
    ctx.fillStyle = isNight ? '#000033' : '#87CEEB';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Stars (Night only)
    if (isNight) {
        ctx.fillStyle = '#FFF';
        for (let i = 0; i < 20; i++) {
            // Simple static stars for performance
            const x = (i * 50 + frameCount * 0.1) % canvas.width;
            const y = (i * 37) % (canvas.height / 2);
            ctx.fillRect(x, y, 2, 2);
        }
    }

    // Celestial Body (Sun/Moon)
    drawCelestialBody(isNight);

    handleBackgroundElements(isNight);

    // Ground
    ctx.fillStyle = isNight ? '#3b1e08' : '#8B4513';
    ctx.fillRect(0, canvas.height - GROUND_HEIGHT, canvas.width, GROUND_HEIGHT);

    // Underground Items
    if (Math.random() < 0.005) {
        undergroundItems.push(new UndergroundItem());
    }
    undergroundItems.forEach(item => {
        item.update();
        item.draw();
    });
    undergroundItems = undergroundItems.filter(item => !item.markedForDeletion);

    // Ground Grass Top
    ctx.fillStyle = isNight ? '#1a4d1a' : '#228B22';
    ctx.fillRect(0, canvas.height - GROUND_HEIGHT, canvas.width, 10);
}


// Input Handling
const keys = {};
let touchJump = false;

window.addEventListener('keydown', function (e) {
    keys[e.code] = true;
    if (e.code === 'Space' && gameRunning) {
        e.preventDefault(); // Prevent scrolling
    }
});

window.addEventListener('keyup', function (e) {
    keys[e.code] = false;
});

// Touch support
// Touch support
window.addEventListener('touchstart', function (e) {
    if (e.target.tagName !== 'BUTTON') { // Allow button clicks to pass through
        e.preventDefault();
    }
    if (gameRunning) {
        touchJump = true;
    }
});

// UI Elements
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const scoreDisplay = document.getElementById('score-display');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
// spriteUpload removed

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', resetGame);

// Custom sprite upload removed

function resizeCanvas() {
    canvas.width = document.getElementById('game-container').clientWidth;
    canvas.height = document.getElementById('game-container').clientHeight;

    // Calculate dynamic ground height to center the game vertically
    if (canvas.height > BASE_GAME_HEIGHT) {
        GROUND_HEIGHT = BASE_GROUND_HEIGHT + (canvas.height - BASE_GAME_HEIGHT) / 2;
    } else {
        GROUND_HEIGHT = BASE_GROUND_HEIGHT;
    }

    // Reposition Player
    if (player.grounded) {
        player.y = canvas.height - GROUND_HEIGHT - player.height;
    } else {
        // If jumping, try to maintain relative height or just let gravity handle it
        // For simplicity, we won't snap him if he's mid-air, but the ground check in update() uses the new GROUND_HEIGHT
    }

    // Reposition Obstacles
    obstacles.forEach(obstacle => {
        obstacle.y = canvas.height - GROUND_HEIGHT - obstacle.height;
    });
}

window.addEventListener('resize', resizeCanvas);

function spawnObstacle() {
    if (Math.random() < 0.02) { // Random spawn chance
        // Ensure minimum distance between obstacles
        if (obstacles.length === 0 || canvas.width - obstacles[obstacles.length - 1].x > 250) {
            obstacles.push(new Obstacle());
        }
    }
}

function checkCollision(rect1, rect2) {
    // Shrink hitbox slightly for fairness
    const padding = 10;
    return (
        rect1.x + padding < rect2.x + rect2.width - padding &&
        rect1.x + rect1.width - padding > rect2.x + padding &&
        rect1.y + padding < rect2.y + rect2.height - padding &&
        rect1.y + rect1.height - padding > rect2.y + padding
    );
}

function gameLoop() {
    if (!gameRunning) return;

    // Draw Background (Sky, Clouds, Birds, Ground, Day/Night)
    drawBackground();

    // Player
    player.update();
    player.draw();

    // Obstacles
    spawnTimer--;
    if (spawnTimer <= 0) {
        obstacles.push(new Obstacle());
        // Randomize next spawn (between 60 and 150 frames)
        // Adjust based on gameSpeed to keep distance somewhat consistent in time, or just random frames
        spawnTimer = 60 + Math.random() * 90;
    }

    obstacles.forEach((obstacle, index) => {
        obstacle.update();
        obstacle.draw();

        // Collision Detection
        // AABB Collision with some padding
        if (
            player.x < obstacle.x + obstacle.width - 10 &&
            player.x + player.width - 10 > obstacle.x &&
            player.y < obstacle.y + obstacle.height - 10 &&
            player.y + player.height > obstacle.y
        ) {
            // Collision!
            gameOver();
        }
    });

    // Remove off-screen obstacles (Right side now)
    obstacles = obstacles.filter(obstacle => obstacle.x < canvas.width + 100);

    // Score
    score += 0.1;
    scoreDisplay.innerText = Math.floor(score);

    // Speed increase
    if (frameCount % 500 === 0) {
        gameSpeed += 0.5;
    }

    frameCount++;
    animationId = requestAnimationFrame(gameLoop);
}

// Start Game
function startGame() {
    resizeCanvas();
    gameRunning = true;
    score = 0;
    jumpCount = 0;
    gameSpeed = 5;
    spawnTimer = 0; // Spawn immediately
    obstacles = [];
    clouds = []; // Reset clouds for direction change
    birds = []; // Reset birds
    undergroundItems = []; // Reset underground items
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    scoreDisplay.classList.remove('hidden');
    document.getElementById('leaderboard-container').innerHTML = ''; // Clear leaderboard

    // Reset Player Position (Right side)
    player.x = canvas.width - 100;
    player.y = canvas.height - GROUND_HEIGHT - 100;
    player.dy = 0;
    player.grounded = true;
    player.dead = false; // Reset dead state
    player.rotation = 0; // Reset rotation

    // Audio context resume removed as we are using file-based audio
    if (bgm) {
        bgm.currentTime = 0;
        bgm.play().catch(e => console.log("BGM failed to play", e));
    }

    gameLoop();
}

function resetGame() {
    startGame();
}

function gameOver() {
    if (!gameRunning) return; // Prevent multiple calls

    // Set player to dead state for animation
    player.dead = true;
    player.dy = 0; // No pop up, just fall/burn

    // Don't stop game immediately, let animation play for a bit
    // But stop obstacles/score
    gameRunning = false;

    // Continue animation loop for death effect
    function deathLoop() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawBackground();
        player.update();
        player.draw();

        // Draw static obstacles
        obstacles.forEach(obstacle => obstacle.draw());

        if (player.y < canvas.height - GROUND_HEIGHT - player.height || Math.abs(player.dy) > 0.1) {
            requestAnimationFrame(deathLoop);
        } else {
            // Animation finished, show UI
            showGameOverUI();
        }
    }
    deathLoop();

    playGameOverSound();
}

function showGameOverUI() {
    cancelAnimationFrame(animationId);

    const gameOverScreen = document.getElementById('game-over-screen');
    const gameOverContent = document.getElementById('game-over-content');

    gameOverScreen.classList.remove('hidden');
    gameOverContent.classList.add('hidden'); // Hide content for blast effect
    scoreDisplay.classList.add('hidden');

    const finalScore = Math.floor(score);
    document.getElementById('final-score').innerText = finalScore;

    // Start blood effect (kept for dramatic effect if desired, or remove?)
    // User asked for fire animation in play again screen.
    // Let's replace the static image with fire animation
    startFireAnimationUI();

    // Check High Score
    if (window.Leaderboard) {
        console.log("Checking high score for:", finalScore);
        Leaderboard.isHighScore(finalScore).then(isHigh => {
            console.log("Is high score?", isHigh);
            if (isHigh) {
                // Show Input Modal
                console.log("Showing high score modal");
                const modal = document.getElementById('highscore-modal');
                modal.classList.remove('hidden');

                // Handle Submit
                const submitBtn = document.getElementById('submit-score-btn');
                const nameInput = document.getElementById('player-name');

                // Remove old listeners to prevent duplicates
                const newBtn = submitBtn.cloneNode(true);
                submitBtn.parentNode.replaceChild(newBtn, submitBtn);

                newBtn.addEventListener('click', () => {
                    const name = nameInput.value.trim() || 'Anonymous';
                    Leaderboard.saveScore(name, finalScore).then(() => {
                        modal.classList.add('hidden');
                        Leaderboard.render('leaderboard-container');
                    });
                });
            } else {
                // Just show leaderboard
                Leaderboard.render('leaderboard-container');
            }
        });
    }
}

function startFireAnimationUI() {
    const img = document.querySelector('.fire-animation-container img');
    if (!img) return;

    // Clear previous interval
    if (window.fireInterval) clearInterval(window.fireInterval);

    let frame = 0;
    window.fireInterval = setInterval(() => {
        frame++;
        const index = frame % 3;
        // Use the paths directly since we know them
        // Add cache buster to force reload with proper CSS
        img.src = `assets/fire${index + 1}.png?v=2`;

        // Force style application
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
        img.style.width = 'auto';
        img.style.height = 'auto';
    }, 150);
}

function startBloodEffect() {
    const container = document.querySelector('.start-graphic');
    if (!container) return;

    // Clear previous intervals if any
    if (window.bloodInterval) clearInterval(window.bloodInterval);

    window.bloodInterval = setInterval(() => {
        const blood = document.createElement('div');
        blood.classList.add('blood-particle');

        // Position relative to the container (which centers the image)
        // Mouth is roughly in the top third, slightly right of center
        const startX = 50 + (Math.random() * 10 - 5);
        const startY = 30 + (Math.random() * 10 - 5);

        blood.style.left = startX + '%';
        blood.style.top = startY + '%';

        // Random velocity
        const vx = (Math.random() - 0.5) * 20;
        const vy = -Math.random() * 20 - 10;

        blood.style.setProperty('--vx', vx + 'px');
        blood.style.setProperty('--vy', vy + 'px');

        container.appendChild(blood);

        // Remove after animation
        setTimeout(() => blood.remove(), 1000);
    }, 50);
}
// Initial setup
resizeCanvas();

// Load leaderboard on start
if (window.Leaderboard) {
    Leaderboard.render('leaderboard-container-start');
}
