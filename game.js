let ROWS = 6;
let COLS = 6;
const boardEl = document.getElementById('board');
const turnEl = document.getElementById('turn');
const selectedEl = document.getElementById('selected');
const resetBtn = document.getElementById('reset');
const boardSizeEl = document.getElementById('board-size');
const bomberCountEl = document.getElementById('bomber-count');
const bombDelayEl = document.getElementById('bomb-delay');
const bombDelayValueEl = document.getElementById('bomb-delay-value');
const moveRangeEl = document.getElementById('move-range');
const moveRangeValueEl = document.getElementById('move-range-value');

function createInitialState(size){
	const rows = size;
	const cols = size;
	const bomberCount = Number(bomberCountEl.value || 2);
	return {
		cells:[],turn:1,selected:null,awaitingBomb:null,bombs:[],
		players:{
			1:{bombers:[{r:0,c:0,owner:1},{r:0,c:cols-1,owner:1}].slice(0,bomberCount)},
			2:{bombers:[{r:rows-1,c:0,owner:2},{r:rows-1,c:cols-1,owner:2}].slice(0,bomberCount)}
		}
	}
}

let state = createInitialState(6);

function dbg(msg){
	try{
		const el = document.getElementById('error');
		if(el){el.style.display='block'; el.textContent = msg}
	}catch(e){}
	console.log('[DBG]',msg);
}
function init(){
	try{
		boardEl.innerHTML = '';
		boardEl.style.gridTemplateColumns = `repeat(${COLS},var(--cell-size))`;
		boardEl.style.gridTemplateRows = `repeat(${ROWS},var(--cell-size))`;
		state.cells = Array.from({length:ROWS},(_,r)=>Array.from({length:COLS},(_,c)=>({r,c,blocked:false})))
		for(let r=0;r<ROWS;r++){
			for(let c=0;c<COLS;c++){
				const cell = document.createElement('div');
				cell.className = 'cell';
				cell.dataset.r = r;
				cell.dataset.c = c;
				cell.addEventListener('click',onCellClick);
				boardEl.appendChild(cell);
			}
		}
		updateBombDelayLabel();
		updateMoveRangeLabel();
		render();
	}catch(err){console.error('init error',err);throw err}
}

function render(){
	try{
		turnEl.textContent = `Turn: Player ${state.turn}`;
		selectedEl.textContent = state.selected?`Selected: ${state.selected.r},${state.selected.c}`:'Selected: None';
		// clear cells
		for(let r=0;r<ROWS;r++){
			for(let c=0;c<COLS;c++){
				const el = getCellEl(r,c);
				if(!el) continue;
				el.className = 'cell';
				// clear previous contents so bombers don't accumulate
				el.innerHTML = '';
				const cell = state.cells[r][c];
				if(cell && cell.blocked) el.classList.add('blocked');
			}
		}
		// draw bombers
		Object.values(state.players).forEach(p=>p.bombers.forEach(b=>{
			if(!isCellBlocked(b.r,b.c)){
				const el = getCellEl(b.r,b.c);
				if(!el) return;
				const div = document.createElement('div');
				div.className = 'bomber ' + (b.owner===1?'b1':'b2');
				div.textContent = b.owner===1?'A':'B';
				el.appendChild(div);
			}
		}))
		state.bombs.forEach(bomb=>{
			const el = getCellEl(bomb.r,bomb.c);
			if(!el) return;
			const marker = document.createElement('div');
			marker.className = 'bomb-marker';
			marker.textContent = String(bomb.turnsRemaining);
			el.appendChild(marker);
		});

		// highlight bomb placement candidates if awaitingBomb
		if(state.awaitingBomb){
			state.awaitingBomb.candidates.forEach(p=>{
				const el = getCellEl(p.r,p.c);
				if(el) el.classList.add('target');
			})
		}
	}catch(err){
		dbg('render error: '+(err && err.message));
		console.error(err);
		throw err;
	}
}

function getCellEl(r,c){return boardEl.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`) }
function isCellBlocked(r,c){return state.cells[r][c].blocked}
function isCellUnavailable(r,c){const cell=state.cells[r][c];return !cell || cell.blocked}

function getBombPlacementCandidates(r,c){
	const candidates = [];
	for(let dr=-1;dr<=1;dr++){
		for(let dc=-1;dc<=1;dc++){
			if(dr===0 && dc===0) continue;
			const nr=r+dr, nc=c+dc;
			if(nr<0 || nr>=ROWS || nc<0 || nc>=COLS) continue;
			if(isCellUnavailable(nr,nc) || findBomberAt(nr,nc)) continue;
			candidates.push({r:nr,c:nc});
		}
	}
	return candidates;
}

function updateBombDelayLabel(){
	const delay = Number(bombDelayEl.value || 3);
	bombDelayValueEl.textContent = `${delay} ${delay===1?'turn':'turns'}`;
}

function getMaxMoveDistance(){return Number(moveRangeEl.value || 3)}

function updateMoveRangeLabel(){
	const moves = getMaxMoveDistance();
	moveRangeValueEl.textContent = `${moves} ${moves===1?'move':'moves'}`;
}

function getExplosionCells(r,c){
	const cells = [{r,c}];
	for(const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){
		const nr=r+dr, nc=c+dc;
		if(nr>=0 && nr<ROWS && nc>=0 && nc<COLS){
			cells.push({r:nr,c:nc});
		}
	}
	return cells;
}

function explodeBomb(bomb){
	const blastCells = getExplosionCells(bomb.r,bomb.c);
	blastCells.forEach(({r,c})=>{
		if(r<0 || r>=ROWS || c<0 || c>=COLS) return;
		if(findBomberAt(r,c)) return;
		const cell = state.cells[r][c];
		if(cell){ cell.blocked = true; }
	});
	state.bombs = state.bombs.filter(activeBomb => activeBomb !== bomb);
}


function onCellClick(e){
	const r = Number(e.currentTarget.dataset.r), c = Number(e.currentTarget.dataset.c);
	// If awaiting bomb placement, treat this click as bomb-target selection
	if(state.awaitingBomb){
		const origin = state.awaitingBomb.origin;
		const candidates = state.awaitingBomb.candidates;
		const hit = candidates.find(p=>p.r===r && p.c===c);
		if(hit){
			dropBomb(r,c);
			state.awaitingBomb = null;
			state.selected = null;
			state.turn = state.turn===1?2:1;
			render();
			checkGameOver();
			return;
		}else{ alert('Invalid bomb target'); return; }
	}

	// select own bomber
	const bomber = findBomberAt(r,c);
	if(bomber && bomber.owner===state.turn){ state.selected = {r,c}; render(); return }

	// move if selected
	if(state.selected){
		const dist = Math.max(Math.abs(state.selected.r - r), Math.abs(state.selected.c - c));
		const maxMoves = getMaxMoveDistance();
		if(dist>maxMoves){ alert(`Can only move up to ${maxMoves} ${maxMoves===1?'space':'spaces'}`); return }
		if(isCellUnavailable(r,c)){ alert('Cell unavailable'); return }
		if(findBomberAt(r,c)){ alert('Cell occupied'); return }
		if(!hasClearPath(state.selected.r,state.selected.c,r,c)){ alert('Path blocked'); return }
		moveBomber(state.selected.r, state.selected.c, r, c);
		state.selected = {r,c};
		tickBombs();
		// Allow choosing any legal square around the moved bomber.
		const candidates = getBombPlacementCandidates(r,c);
		if(candidates.length===0){
			alert('No legal bomb target available');
			state.selected = {r,c};
			return;
		}else{
			state.awaitingBomb = { origin: {r,c}, candidates };
			render();
			// wait for bomb placement before switching turn
		}
	}
}

function findBomberAt(r,c){for(const p of [1,2]){for(const b of state.players[p].bombers){if(b.r===r && b.c===c) return b}}return null}

function hasClearPath(sr,sc,tr,tc){
	const queue = [{r:sr,c:sc,steps:0}];
	const visited = new Set([`${sr},${sc}`]);
	const maxMoves = getMaxMoveDistance();
	for(let index=0;index<queue.length;index++){
		const current = queue[index];
		if(current.r===tr && current.c===tc) return true;
		if(current.steps===maxMoves) continue;
		for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
			const nr=current.r+dr, nc=current.c+dc;
			const key=`${nr},${nc}`;
			if(nr<0 || nr>=ROWS || nc<0 || nc>=COLS || visited.has(key)) continue;
			if(isCellUnavailable(nr,nc) || findBomberAt(nr,nc)) continue;
			visited.add(key);
			queue.push({r:nr,c:nc,steps:current.steps+1});
		}
	}
	return false;
}

function moveBomber(sr,sc,tr,tc){const b = findBomberAt(sr,sc);if(!b) return; b.r=tr;b.c=tc}

function dropBomb(r,c){
	const cell = state.cells[r][c];
	if(!cell || isCellUnavailable(r,c) || findBomberAt(r,c)) return false;
	cell.blocked = true;
	state.bombs.push({r,c,turnsRemaining:Number(bombDelayEl.value || 3)});
	return true;
}

function tickBombs(newBomb=null){
	for(const bomb of [...state.bombs]){
		if(bomb===newBomb) continue;
		bomb.turnsRemaining--;
		if(bomb.turnsRemaining>0) continue;
		explodeBomb(bomb);
	}
}

function checkGameOver(){
 const currentPlayer = state.turn;
 if(!hasAnyMove(currentPlayer)){
  const winner = currentPlayer===1?2:1;
  alert(`Player ${currentPlayer} has no moves — player ${winner} wins!`);
 }
}

function hasAnyMove(player){
	const maxMoves = getMaxMoveDistance();
	for(const b of state.players[player].bombers){
		for(let dr=-maxMoves;dr<=maxMoves;dr++){
			for(let dc=-maxMoves;dc<=maxMoves;dc++){
				const r=b.r+dr,c=b.c+dc;
				if(r<0||r>=ROWS||c<0||c>=COLS) continue;
				const dist=Math.max(Math.abs(dr),Math.abs(dc));
				if(dist===0 || dist>maxMoves) continue;
				if(!isCellUnavailable(r,c) && !findBomberAt(r,c) && hasClearPath(b.r,b.c,r,c)) return true;
			}
		}
	}
	return false;
}

function changeBoardSize(size){
	ROWS = size;
	COLS = size;
	state = createInitialState(size);
	boardSizeEl.value = String(size);
	init();
}

resetBtn.addEventListener('click',()=>changeBoardSize(ROWS));
boardSizeEl.addEventListener('change',()=>changeBoardSize(Number(boardSizeEl.value)));
bomberCountEl.addEventListener('change',()=>changeBoardSize(ROWS));
bombDelayEl.addEventListener('input',updateBombDelayLabel);
moveRangeEl.addEventListener('input',updateMoveRangeLabel);

init()
