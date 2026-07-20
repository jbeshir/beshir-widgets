export function rand(s:{rng:number}){let x=s.rng|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.rng=x>>>0;return (s.rng>>>0)/4294967296}
