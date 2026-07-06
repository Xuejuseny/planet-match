const SIZE = 8;
const TYPES = 6;
const TARGET_SCORE = 5000;
const START_MOVES = 25;
const CLEAR_DELAY = 180;

const boardEl = document.getElementById("board");
const scoreEl = document.getElementById("score");
const targetEl = document.getElementById("target");
const movesEl = document.getElementById("moves");
const messageEl = document.getElementById("message");
const restartBtn = document.getElementById("restart");

let board = [];
let selected = null;
let score = 0;
let moves = START_MOVES;
let busy = false;
let gameOver = false;

targetEl.textContent = TARGET_SCORE;

function randomType() {
  return Math.floor(Math.random() * TYPES);
}

function createBoard() {
  let nextBoard = [];

  do {
    nextBoard = [];

    for (let row = 0; row < SIZE; row += 1) {
      nextBoard[row] = [];

      for (let col = 0; col < SIZE; col += 1) {
        let type = randomType();

        while (
          (col >= 2 && nextBoard[row][col - 1] === type && nextBoard[row][col - 2] === type) ||
          (row >= 2 && nextBoard[row - 1][col] === type && nextBoard[row - 2][col] === type)
        ) {
          type = randomType();
        }

        nextBoard[row][col] = type;
      }
    }
  } while (!hasPossibleMove(nextBoard));

  return nextBoard;
}

function renderBoard(clearing = new Set()) {
  boardEl.innerHTML = "";

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const tile = document.createElement("button");
      const type = board[row][col];
      const key = cellKey(row, col);

      tile.type = "button";
      tile.className = `tile type-${type}`;
      tile.dataset.row = row;
      tile.dataset.col = col;
      tile.setAttribute("role", "gridcell");
      tile.setAttribute("aria-label", `第 ${row + 1} 行第 ${col + 1} 列，${tileName(type)}`);

      if (selected && selected.row === row && selected.col === col) {
        tile.classList.add("selected");
      }

      if (clearing.has(key)) {
        tile.classList.add("clearing");
      }

      tile.addEventListener("click", () => handleTileClick(row, col));
      boardEl.appendChild(tile);
    }
  }
}

function tileName(type) {
  return ["蓝色星核", "粉色星核", "绿色星核", "金色星核", "紫色星核", "黄绿星核"][type];
}

function cellKey(row, col) {
  return `${row},${col}`;
}

function updateStats() {
  scoreEl.textContent = score;
  movesEl.textContent = moves;
}

function setMessage(text, state = "") {
  messageEl.textContent = text;
  messageEl.className = `message ${state}`.trim();
}

async function handleTileClick(row, col) {
  if (busy || gameOver) {
    return;
  }

  if (!selected) {
    selected = { row, col };
    renderBoard();
    return;
  }

  if (selected.row === row && selected.col === col) {
    selected = null;
    renderBoard();
    return;
  }

  if (!isAdjacent(selected, { row, col })) {
    selected = { row, col };
    renderBoard();
    return;
  }

  busy = true;
  const first = selected;
  const second = { row, col };
  selected = null;

  swap(first, second);
  renderBoard();

  const matches = findMatches();
  if (matches.size === 0) {
    setMessage("这次没有连成 3 个，方块已回到原位。");
    await wait(180);
    swap(first, second);
    renderBoard();
    busy = false;
    return;
  }

  moves -= 1;
  await resolveMatches(matches);
  updateStats();
  checkGameState();
  busy = false;
}

function isAdjacent(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

function swap(a, b) {
  const temp = board[a.row][a.col];
  board[a.row][a.col] = board[b.row][b.col];
  board[b.row][b.col] = temp;
}

function findMatches() {
  const matches = new Set();

  for (let row = 0; row < SIZE; row += 1) {
    let runStart = 0;

    for (let col = 1; col <= SIZE; col += 1) {
      if (col < SIZE && board[row][col] === board[row][runStart]) {
        continue;
      }

      if (col - runStart >= 3) {
        for (let matchCol = runStart; matchCol < col; matchCol += 1) {
          matches.add(cellKey(row, matchCol));
        }
      }

      runStart = col;
    }
  }

  for (let col = 0; col < SIZE; col += 1) {
    let runStart = 0;

    for (let row = 1; row <= SIZE; row += 1) {
      if (row < SIZE && board[row][col] === board[runStart][col]) {
        continue;
      }

      if (row - runStart >= 3) {
        for (let matchRow = runStart; matchRow < row; matchRow += 1) {
          matches.add(cellKey(matchRow, col));
        }
      }

      runStart = row;
    }
  }

  return matches;
}

async function resolveMatches(initialMatches) {
  let matches = initialMatches;
  let chain = 0;

  while (matches.size > 0) {
    chain += 1;
    score += matches.size * 40 * chain;
    setMessage(chain > 1 ? `连锁 ${chain} 段！星能继续爆发。` : "命中！星核正在重组。");
    renderBoard(matches);
    await wait(CLEAR_DELAY);

    removeMatches(matches);
    collapseColumns();
    fillBoard();
    renderBoard();
    await wait(120);
    matches = findMatches();
  }

  ensurePlayableBoard();
}

function removeMatches(matches) {
  matches.forEach((key) => {
    const [row, col] = key.split(",").map(Number);
    board[row][col] = null;
  });
}

function collapseColumns() {
  for (let col = 0; col < SIZE; col += 1) {
    const remaining = [];

    for (let row = SIZE - 1; row >= 0; row -= 1) {
      if (board[row][col] !== null) {
        remaining.push(board[row][col]);
      }
    }

    for (let row = SIZE - 1; row >= 0; row -= 1) {
      board[row][col] = remaining[SIZE - 1 - row] ?? null;
    }
  }
}

function fillBoard() {
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (board[row][col] === null) {
        board[row][col] = randomType();
      }
    }
  }
}

function ensurePlayableBoard() {
  if (hasPossibleMove(board)) {
    return;
  }

  board = createBoard();
  setMessage("星图重排完成，新的机会出现了。");
  renderBoard();
}

function hasPossibleMove(testBoard) {
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const right = { row, col: col + 1 };
      const down = { row: row + 1, col };

      if (col + 1 < SIZE && swapCreatesMatch(testBoard, { row, col }, right)) {
        return true;
      }

      if (row + 1 < SIZE && swapCreatesMatch(testBoard, { row, col }, down)) {
        return true;
      }
    }
  }

  return false;
}

function swapCreatesMatch(testBoard, first, second) {
  const copy = testBoard.map((row) => [...row]);
  const temp = copy[first.row][first.col];
  copy[first.row][first.col] = copy[second.row][second.col];
  copy[second.row][second.col] = temp;
  return findMatchesInBoard(copy).size > 0;
}

function findMatchesInBoard(testBoard) {
  const originalBoard = board;
  board = testBoard;
  const matches = findMatches();
  board = originalBoard;
  return matches;
}

function checkGameState() {
  updateStats();

  if (score >= TARGET_SCORE) {
    gameOver = true;
    setMessage("任务完成！你点亮了这片星域。", "win");
    return;
  }

  if (moves <= 0) {
    gameOver = true;
    setMessage("步数用完了，星域还差一点能量。", "lose");
    return;
  }

  setMessage("继续交换相邻方块，冲向目标分。");
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function startGame() {
  board = createBoard();
  selected = null;
  score = 0;
  moves = START_MOVES;
  busy = false;
  gameOver = false;
  updateStats();
  setMessage("交换相邻方块，连接 3 个同色星核。");
  renderBoard();
}

restartBtn.addEventListener("click", startGame);
startGame();
