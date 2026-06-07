import { AGENTS } from './src/data/agents.js';

console.log("Successfully imported AGENTS from workspace root! Count:", AGENTS.length);
for (const agent of AGENTS) {
    console.log(`- ${agent.name} (${agent.role}): animal=${agent.animal}, provider=${agent.provider}, model=${agent.model}`);
}
