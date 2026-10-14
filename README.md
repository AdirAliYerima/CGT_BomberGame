# CGT Bomber Game

Open `index.html` in a browser to play locally. 
Choose one or two bombers per player before play; changing the count starts a new game. Click a bomber (A or B) to select it, then click a destination reachable within the bomber move limit selected by the slider (1 to 5 orthogonal or diagonal steps). Bombers cannot pass through blocked or occupied cells.
After moving, choose any legal adjacent cell to drop a bomb. Each bomb uses the fuse value selected by the bomb-delay slider. On each subsequent bomber move, its counter decreases by one; when it reaches zero, the bomb explodes in the center and the four orthogonal neighboring cells. 
Unoccupied blast cells become blocked, while any cell occupied by a bomber is skipped and stays open. 
A player loses when none of their bombers has a legal move.


Furthermore the custom parameters such as the selection of bombers per players, the bomb delay meaning the number of turn need to be taken for a bomb to explode, the the limit on up to the numbers of move a bomber can make. 

Another way to run 
python -m http.server 8081 
In brownser http://localhost:8081 

