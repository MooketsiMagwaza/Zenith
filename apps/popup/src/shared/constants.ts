export const DECK_COLORS = ['#c9a84c','#7a8a7a','#b0a999','#9a8a6a','#6a8a9a','#8a7a9a','#9a7a6a','#7a9a8a']
export const STORAGE_KEY = 'zenith_agent_state'
export const QUOTE_PACKS: Record<string, string[]> = {
  musashi: ['The way is in training.','Do nothing which is of no use.','Today is victory over yourself of yesterday.'],
  stoic: ['You have power over your mind—not outside events.','Waste no more time arguing what a good man should be. Be one.'],
  bible: ['Be still, and know that I am God.','I can do all things through Christ who strengthens me.'],
  zen: ['Before enlightenment, chop wood, carry water. After enlightenment, chop wood, carry water.','The obstacle is the path.']
}
export const WALLPAPERS = {
  pastel: ['#f5f0e6','#e8d5c4','#d4c4b0','#c9b8a8','#b8a894'],
  gradient: ['linear-gradient(135deg,#1a1a2e,#16213e)','linear-gradient(135deg,#0f0c29,#302b63,#24243e)','linear-gradient(135deg,#2c3e50,#4ca1af)'],
  curated: ['url(https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920)','url(https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920)']
}
export const DEFAULT_STATE: any = {
  version:0, 
  decks:[
    {id:'deck-academic',name:'Academics',color:'#c9a84c',createdAt:0},
    {id:'deck-projects',name:'Projects',color:'#7a8a7a',createdAt:0}
  ],
  tasks:[], logs:[], journals:[], active:null, reminders:[],
  tutorialSeen:false, zenPack:'musashi', zenInterval:0, zenWallpaper:WALLPAPERS.curated[0]
}
