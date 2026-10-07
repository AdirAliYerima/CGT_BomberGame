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
        addEventListener() {},
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
let lastAlert = '';
const elements = {
    board,
    turn: makeElement(),
    selected: makeElement(),
    reset: makeElement(),
    'board-size': boardSize,
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

console.log('Bomb placement and board-size regression tests passed: 8 checks');
