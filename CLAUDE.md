# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a collection of browser-based retro games built with vanilla HTML5, CSS3, and JavaScript. Each game is self-contained in a single HTML file with embedded styles and game logic using HTML5 Canvas API.

## Running the Games

To run the games locally:
```bash
python3 -m http.server 8000
open http://localhost:8000
```

Then navigate through the arcade menu or directly open individual game files:
- `pong.html` - http://localhost:8000/pong.html
- `flappy-bird.html` - http://localhost:8000/flappy-bird.html
- `snake.html` - http://localhost:8000/snake.html
- `rooftop-snipers.html` - http://localhost:8000/rooftop-snipers.html
- `chess.html` - http://localhost:8000/chess.html

## Architecture

### File Structure
- `index.html` - Landing page arcade menu with game selection cards
- Individual game files (`.html`) - Each contains a complete game with:
  - Embedded CSS for styling
  - HTML5 Canvas element for rendering
  - JavaScript game loop using `requestAnimationFrame`
  - Game state management in JavaScript objects

### Common Patterns

All games follow a similar architecture:

1. **Game State Object**: Central `gameState` object containing all game variables (player positions, scores, velocities, particles, etc.)

2. **Game Loop Pattern**: Standard game loop with three phases:
   ```javascript
   function gameLoop() {
       updateGame();    // Update game state (physics, collisions, AI)
       draw();          // Render current state
       requestAnimationFrame(gameLoop);
   }
   ```

3. **Canvas Rendering**: All games use 2D canvas context (`ctx`) with:
   - Gradients for visual effects
   - Shadow effects for depth
   - Particle systems for visual feedback

4. **Input Handling**: Keyboard event listeners stored in `keys` object with debouncing/rate limiting for actions

5. **Local Storage**: High scores persisted using `localStorage.getItem()` and `localStorage.setItem()`

### Special Features

#### Secret Codes (Easter Eggs)
Several games contain secret cheat codes activated by typing specific strings:

- **Pong**: Type "mad hopps" before starting → enables gravity-based jumping for player paddle
- **Rooftop Snipers**:
  - Type "thomas" before mode selection → unlocks "Thomasagun" weapon (10x damage, purple bullets)
  - Type "mad hopps" → enables super jump for player 1

Secret codes are tracked via character accumulation in keydown events.

#### Game-Specific Architecture

**Pong** (`pong.html`):
- Player vs AI with paddle physics
- Ball has spin mechanics affecting trajectory
- Particle effects on collisions
- Score to 5 wins

**Flappy Bird** (`flappy-bird.html`):
- Uses external image asset: `andrew.jpg` for bird sprite
- Procedural pipe generation every 90 frames
- Gravity-based physics with flap impulse
- Collision detection with pipes and boundaries

**Snake** (`snake.html`):
- Grid-based movement system (20x20 grid)
- Buffered direction input (`nextDirection`) to prevent reverse moves
- Speed increases with each food eaten
- Pawn respawn in gap if fallen

**Rooftop Snipers** (`rooftop-snipers.html`):
- Two-player or vs AI mode
- Multiple weapon system (Pistol, SMG, Shotgun, RPG, Axe)
- Health bar system (5 HP)
- Gap-based level design with two rooftops
- Physics-based character rotation on hit
- AI with tactical weapon switching and positioning

**Chess** (`chess.html`):
- Standard chess rules with move validation
- Unicode symbols for pieces (♔♕♖♗♘♙)
- Turn-based two-player local gameplay
- Auto-promotion to queen on pawn reaching end row
- No check/checkmate detection (simplified rules)

## Development Guidelines

### Modifying Games
- All game logic is in a single `<script>` tag in each HTML file
- Game constants (like `GRAVITY`, `PADDLE_WIDTH`, etc.) are defined at top of script
- Visual styling uses inline `<style>` tags with CSS gradients

### Adding New Features
- Maintain the self-contained single-file structure
- Follow existing patterns: game state object → update loop → draw loop
- Use `requestAnimationFrame` for smooth animation
- Add particle effects for player feedback

### Testing
Since these are standalone HTML files, simply refresh the browser to test changes. No build process required.
