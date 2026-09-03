const fs = require('fs');
const f = 'apps/mobile/app/(session)/classroom.tsx';
let c = fs.readFileSync(f, 'utf8');
const old = 'if (!session?.access_token || !studyContext) return;';
const nw = `if (!session?.access_token) return;
    if (!studyContext) {
      router.replace('/(auth)/onboarding');
      return;
    }`;
c = c.replace(old, nw);
fs.writeFileSync(f, c, 'utf8');
console.log('done - occurrences replaced:', (c.match(/router\.replace\('\/\(auth\)\/onboarding'\)/g) || []).length);
