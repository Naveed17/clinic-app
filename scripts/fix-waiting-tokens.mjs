import fs from 'node:fs';

const p = 'src/renderer/src/features/waiting-room/WaitingRoomPage.tsx';
let s = fs.readFileSync(p, 'utf8');
s = s.replace('tokens as fuiTokens', 'tokens');
s = s.replace(
  /const mine = useMemo\(\s*\(\) => tokens\.filter\(\(t\) => t\.doctorId === user\?\.id\),\s*\[tokens, user\?\.id\],\s*\);/,
  `const mine = useMemo(
    () => tokenList.filter((t) => t.doctorId === user?.id),
    [tokenList, user?.id],
  );`,
);
fs.writeFileSync(p, s, 'utf8');
console.log('fixed waiting room');
