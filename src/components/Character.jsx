import { motion, AnimatePresence } from 'framer-motion'
import AgentAvatar from './Avatars'

const stateVariants = {
  idle:     { y: [0, -4, 0],           transition: { duration: 2.8, repeat: Infinity, ease: 'easeInOut' } },
  thinking: { y: [0,-3,0], rotate: [-3,3,-3], transition: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } },
  typing:   { y: [0,-2,0,-2,0],        transition: { duration: 0.22, repeat: Infinity, ease: 'easeInOut' } },
  done:     { scale: [1,1.18,0.95,1.05,1], transition: { duration: 0.7, times: [0,0.3,0.6,0.8,1] } },
}

export default function Character({ agent, state, isSelected, onClick, taskText, flowIndex }) {
  return (
    <div
      className="flex flex-col items-center cursor-pointer select-none group relative"
      style={{ width: '84px' }}
      onClick={onClick}
    >
      {/* Floating task bubble (Speech Bubble) */}
      <AnimatePresence>
        {taskText && (
          <motion.div
            key={taskText}
            initial={{ opacity: 0, y: 8, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.85 }}
            transition={{ duration: 0.2 }}
            className="absolute whitespace-nowrap rounded-2xl text-gray-800 font-bold border pointer-events-none shadow-xl flex items-center justify-center gap-1.5"
            style={{
              top: '-36px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'white',
              borderColor: `${agent.color}40`,
              fontSize: '10px',
              padding: '6px 12px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              zIndex: 10,
            }}
          >
            {/* Speech bubble tail */}
            <div
              className="absolute bottom-[-5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white border-r border-b"
              style={{
                borderColor: `${agent.color}40`,
                transform: 'translateX(-50%) rotate(45deg)',
              }}
            />
            {flowIndex !== null && flowIndex !== undefined && (
              <span
                className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center rounded-full text-white text-[10px] font-black bg-emerald-500 border border-white/20 shadow-md"
                style={{ zIndex: 12 }}
              >
                {flowIndex}
              </span>
            )}
            <span>{taskText}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected name tag */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute whitespace-nowrap px-2 py-0.5 rounded-full text-xs font-semibold text-white shadow-lg pointer-events-none"
            style={{
              top: taskText ? '-54px' : '-26px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: agent.color,
              zIndex: 11,
            }}
          >
            {agent.name}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Avatar */}
      <motion.div
        animate={stateVariants[state] || stateVariants.idle}
        className="relative"
        style={isSelected ? { filter: `drop-shadow(0 0 12px ${agent.color}cc)` } : {}}
      >
        <AgentAvatar animal={agent.animal} state={state} />
        <motion.div
          className="absolute inset-0 rounded-full pointer-events-none"
          animate={isSelected ? {
            boxShadow: [`0 0 0 0 ${agent.color}55`, `0 0 0 14px ${agent.color}00`],
          } : {}}
          transition={{ duration: 1.4, repeat: Infinity }}
        />
      </motion.div>

      {/* Ground shadow */}
      <div className="w-12 h-2 rounded-full -mt-1"
        style={{ background: 'rgba(0,0,0,0.28)', filter: 'blur(4px)' }}/>

      {/* Name badge */}
      <div
        className="mt-1 px-2.5 py-0.5 rounded-full font-bold text-white shadow-md group-hover:scale-105 transition-transform"
        style={{ background: agent.color, fontSize: '9px', letterSpacing: '0.04em' }}
      >
        {agent.name}
      </div>
    </div>
  )
}
