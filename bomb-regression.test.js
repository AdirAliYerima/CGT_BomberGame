const fs = require('fs');
const vm = require('vm');

function makeElement() {
    return {
        dataset: {},
        style: {},
        children: [],
        classList: { add() {} },
        innerHTML: '',
        textContent: '',
        listeners: {},
        addEventListener(name, handler) { this.listeners[name] = handler; },
        appendChild(child) { this.children.push(child); return child; },
        querySelector() { return null; }
    };
}

const cells = [];
for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
        const cell = makeElement();
        cell.dataset.r = String(r);
        cell.dataset.c = String(c);
        cells.push(cell);
    }
}

const board = makeElement();
board.querySelector = (selector) => {
    const match = selector.match(/data-r="(\d+)"\]\[data-c="(\d+)"/);
    if (!match) return null;
    return cells[Number(match[1]) * 6 + Number(match[2])];
};

const boardSize = makeElement();
boardSize.value = '6';
const bomberCount = makeElement();
bomberCount.value = '2';
const bombDelay = makeElement();
bombDelay.value = '3';
const bombDelayValue = makeElement();
const moveRange = makeElement();
moveRange.value = '3';
const moveRangeValue = makeElement();
let lastAlert = '';
const elements = {
    board,
    turn: makeElement(),
    selected: makeElement(),
    reset: makeElement(),
    'board-size': boardSize,
    'bomber-count': bomberCount,
    'bomb-delay': bombDelay,
    'bomb-delay-value': bombDelayValue,
    'move-range': moveRange,
    'move-range-value': moveRangeValue,
    error: makeElement()
};

const context = {
    document: {
        getElementById(id) { return elements[id]; },
        createElement: makeElement
    },
    console,
    alert(message) { lastAlert = message; },
    setInterval() { return 1; },
    clearInterval() {}
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('game.js', 'utf8'), context);

bomberCount.value = '1';
bomberCount.listeners.change();
if (vm.runInContext('state.players[1].bombers.length === 1 && state.players[2].bombers.length === 1', context) !== true) {
    throw new Error('Selecting one bomber must create one bomber for each player');
}
bomberCount.value = '2';
bomberCount.listeners.change();
if (vm.runInContext('state.players[1].bombers.length === 2 && state.players[2].bombers.length === 2', context) !== true) {
    throw new Error('Selecting two bombers must create two bombers for each player');
}

if (moveRangeValue.textContent !== '3 moves') {
    throw new Error(`Expected initial move limit label to be 3 moves, got: ${moveRangeValue.textContent}`);
}
moveRange.value = '1';
moveRange.listeners.input();
if (moveRangeValue.textContent !== '1 move' || vm.runInContext('hasClearPath(0, 0, 0, 2) || !hasClearPath(0, 0, 1, 1)', context) !== false) {
	throw new Error('A one-move limit must allow one diagonal step but prevent two-step paths');
}
vm.runInContext('state.selected = {r: 0, c: 0}; onCellClick({currentTarget: {dataset: {r: "0", c: "2"}}})', context);
if (vm.runInContext('findBomberAt(0, 0) !== null && findBomberAt(0, 0).owner === 1 && findBomberAt(0, 2) === null', context) !== true) {
    throw new Error('A bomber must not move beyond the selected move limit');
}
vm.runInContext('state.selected = {r: 0, c: 0}; onCellClick({currentTarget: {dataset: {r: "1", c: "1"}}})', context);
if (vm.runInContext('findBomberAt(1, 1)?.owner === 1 && state.awaitingBomb !== null', context) !== true) {
    throw new Error('A bomber must be able to move diagonally within a one-move limit');
}
vm.runInContext('changeBoardSize(6)', context);
moveRange.value = '5';
moveRange.listeners.input();
if (moveRangeValue.textContent !== '5 moves' || vm.runInContext('hasClearPath(0, 0, 0, 4)', context) !== true) {
    throw new Error('A five-move limit must allow a clear path of five or fewer steps');
}
moveRange.value = '3';
moveRange.listeners.input();

if (bombDelayValue.textContent !== '3 turns') {
    throw new Error(`Expected initial bomb delay label to be 3 turns, got: ${bombDelayValue.textContent}`);
}
bombDelay.value = '2';
bombDelay.listeners.input();
if (bombDelayValue.textContent !== '2 turns') {
    throw new Error(`Expected bomb delay slider to update its label, got: ${bombDelayValue.textContent}`);
}
bombDelay.value = '3';
bombDelay.listeners.input();

const candidates = vm.runInContext('getBombPlacementCandidates(2, 2)', context);
const candidateKeys = new Set(candidates.map(({ r, c }) => `${r},${c}`));
const expected = new Set([
    '1,1', '1,2', '1,3',
    '2,1', '2,3',
    '3,1', '3,2', '3,3'
]);
if (candidateKeys.size !== expected.size || [...expected].some(key => !candidateKeys.has(key))) {
    throw new Error(`Expected eight surrounding cells, got ${JSON.stringify(candidates)}`);
}

const dropped = vm.runInContext('dropBomb(1, 1)', context);
if (dropped !== true || vm.runInContext('state.cells[1][1].blocked', context) !== true) {
    throw new Error('A dropped bomb must block its cell immediately');
}

if (vm.runInContext('dropBomb(1, 1)', context) !== false) {
    throw new Error('A blocked cell must not accept another bomb');
}

vm.runInContext('state.selected = {r: 0, c: 0}; onCellClick({currentTarget: {dataset: {r: "1", c: "1"}}})', context);
if (vm.runInContext('findBomberAt(0, 0) !== null && findBomberAt(1, 1) === null', context) !== true) {
    throw new Error('A bomber moved onto a cell blocked by a dropped bomb');
}

vm.runInContext('state.cells[0][1].blocked = true; state.selected = {r: 0, c: 0}; onCellClick({currentTarget: {dataset: {r: "0", c: "2"}}})', context);
if (vm.runInContext('findBomberAt(0, 0) !== null && findBomberAt(0, 2) === null', context) !== true) {
    throw new Error('A bomber jumped over a blocked cell');
}

vm.runInContext('changeBoardSize(6); dropBomb(2, 2); state.selected = {r: 0, c: 0}; onCellClick({currentTarget: {dataset: {r: "0", c: "1"}}})', context);
if (vm.runInContext('state.cells[2][2].blocked && !state.cells[1][2].blocked && state.bombs[0].turnsRemaining === 2', context) !== true || cells[2 * 6 + 2].children.at(-1).textContent !== '2') {
    throw new Error('A bomb counter must decrease after the first subsequent bomber move');
}
vm.runInContext('onCellClick({currentTarget: {dataset: {r: "0", c: "0"}}}); onCellClick({currentTarget: {dataset: {r: "5", c: "0"}}}); onCellClick({currentTarget: {dataset: {r: "4", c: "0"}}}); onCellClick({currentTarget: {dataset: {r: "5", c: "0"}}})', context);
if (vm.runInContext('state.bombs[0].turnsRemaining === 1 && state.bombs[1].turnsRemaining === 2 && state.bombs[2].turnsRemaining === 3', context) !== true) {
    throw new Error('Bombs must lose one count per subsequent bomber move, while the latest bomb starts at its full fuse');
}
vm.runInContext('onCellClick({currentTarget: {dataset: {r: "0", c: "1"}}}); onCellClick({currentTarget: {dataset: {r: "1", c: "1"}}}); onCellClick({currentTarget: {dataset: {r: "0", c: "1"}}})', context);
if (vm.runInContext('state.cells[2][2].blocked && state.cells[1][2].blocked && state.cells[3][2].blocked && state.cells[2][1].blocked && state.cells[2][3].blocked && !state.cells[1][1].blocked', context) !== true) {
    throw new Error('A 3-turn bomb must explode after three player moves and block its center and four orthogonal neighbors, but not diagonals');
}

bombDelay.value = '2';
vm.runInContext('changeBoardSize(6); dropBomb(2, 2); state.selected = {r: 0, c: 0}; onCellClick({currentTarget: {dataset: {r: "0", c: "1"}}}); onCellClick({currentTarget: {dataset: {r: "0", c: "0"}}}); onCellClick({currentTarget: {dataset: {r: "5", c: "0"}}}); onCellClick({currentTarget: {dataset: {r: "4", c: "0"}}})', context);
if (vm.runInContext('state.bombs.length === 1 && state.bombs[0].turnsRemaining === 1 && state.cells[1][2].blocked && state.cells[3][2].blocked && state.cells[2][1].blocked && state.cells[2][3].blocked', context) !== true) {
    throw new Error('A 2-turn bomb must explode after two subsequent player moves in a four-direction cross');
}

bombDelay.value = '1';
vm.runInContext('changeBoardSize(6); dropBomb(0, 2); tickBombs()', context);
if (vm.runInContext('state.cells[0][2].blocked && state.cells[0][1].blocked && state.cells[0][3].blocked && state.cells[1][2].blocked', context) !== true) {
    throw new Error('A one-turn fuse must explode on the next completed turn and stay within board bounds');
}

vm.runInContext('changeBoardSize(6); dropBomb(1, 1); state.selected = {r: 0, c: 0}; onCellClick({currentTarget: {dataset: {r: "1", c: "0"}}})', context);
if (vm.runInContext('!state.cells[1][0].blocked && findBomberAt(1, 0)?.owner === 1 && state.awaitingBomb !== null && state.turn === 1 && state.cells[1][1].blocked', context) !== true) {
    throw new Error('An explosion must skip a bomber-occupied blast cell without removing the bomber or blocking its space');
}

vm.runInContext('changeBoardSize(4)', context);
if (vm.runInContext('ROWS', context) !== 4 || vm.runInContext('COLS', context) !== 4) {
    throw new Error('Board size change did not update rows and columns');
}
if (vm.runInContext('state.players[1].bombers[1].c', context) !== 3) {
    throw new Error('Board resize did not reposition bombers');
}

vm.runInContext('state.cells.forEach(row => row.forEach(cell => { cell.blocked = true; })); state.turn = 2; checkGameOver()', context);
if (lastAlert !== 'Player 2 has no moves — player 1 wins!') {
    throw new Error(`Expected player 1 to be announced as the winner, got: ${lastAlert}`);
}

console.log('Bomb placement, movement, and board-size regression tests passed: 22 checks');
