import { motion, AnimatePresence } from 'framer-motion'
import AgentAvatar from './Avatars'

const stateVariants = {
  idle:     { y: [0, -4, 0],           transition: { duration: 2.8, repeat: Infinity, ease: 'easeInOut' } },
  thinking: { y: [0,-3,0], rotate: [-3,3,-3], transition: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } },
  typing:   { y: [0,-2,0,-2,0],        transition: { duration: 0.22, repeat: Infinity, ease: 'easeInOut' } },
  done:     { scale: [1,1.18,0.95,1.05,1], transition: { duration: 0.7, times: [0,0.3,0.6,0.8,1] } },
}

export default function Character({ agent, state, isSelected, onClick, taskText }) {
  return (
    <div
      className="flex flex-col items-center cursor-pointer select-none group relative"
      style={{ width: '84px' }}
      onClick={onClick}
    >
      {/* Floating task label */}
      <AnimatePresence>
        {taskText && (
          <motion.div
            key={taskText}
            initial={{ opacity: 0, y: 4, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.85 }}
            transition={{ duration: 0.2 }}
            className="absolute whitespace-nowrap rounded-lg font-bold text-white shadow-lg pointer-events-none"
            style={{
              top: '-26px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: `linear-gradient(135deg, ${agent.color}, ${agent.accent})`,
              fontSize: '8px',
              padding: '2px 7px',
              letterSpacing: '0.03em',
              boxShadow: `0 2px 10px ${agent.color}70`,
              zIndex: 10,
            }}
          >
            {taskText}
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
              top: taskText ? '-44px' : '-26px',
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
