import { defineConfig, presetUno, presetIcons } from 'unocss';

export default defineConfig({
  presets: [
    presetUno(),
    presetIcons({
      scale: 1.2,
      warn: true,
    }),
  ],
  shortcuts: {
    'btn': 'px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer inline-flex items-center gap-2',
    'btn-primary': 'btn bg-blue-500 text-white hover:bg-blue-600',
    'btn-success': 'btn bg-green-500 text-white hover:bg-green-600',
    'btn-ghost': 'btn text-gray-600 hover:bg-gray-100',
    'card': 'bg-white rounded-xl border border-gray-200',
    'input': 'w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition text-sm',
    'badge': 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
  },
});
