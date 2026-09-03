const fs = require('fs');
const f = 'apps/mobile/app/_layout.tsx';
let c = fs.readFileSync(f, 'utf8');

const old = `  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/welcome');
    } else if (session && inAuthGroup) {
      router.replace('/');
    }
  }, [session, loading, segments, router]);`;

const nw = `  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const isWelcomeOrSignIn = segments[1] === 'welcome' || segments[1] === 'sign-in';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/welcome');
    } else if (session && inAuthGroup && isWelcomeOrSignIn) {
      router.replace('/');
    }
  }, [session, loading, segments, router]);`;

c = c.replace(old, nw);
fs.writeFileSync(f, c, 'utf8');
console.log('done - occurrences replaced:', (c.match(/isWelcomeOrSignIn/g) || []).length);
