#!/usr/bin/env node
// Check localStorage for draft actions

const agentId = 'agent-mk6g4y6oepnd';
const draftActionId = 'draft-1768090840791-02bdcwqfr';

console.log('To check draft action in browser localStorage:');
console.log(`localStorage.getItem('draft-actions-${agentId}')`);
console.log('');
console.log('Or run this in browser console:');
console.log(`JSON.parse(localStorage.getItem('draft-actions-${agentId}')).find(a => a.id === '${draftActionId}')`);
