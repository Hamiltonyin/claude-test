import Dialogues from './Dialogues'

/** 歌词背诵：和情景对话同一套界面（滚轴/列表、真人视频、改文字、毛玻璃小圆点）；内容在 content/lyrics/*.txt。 */
export default function Lyrics({ onClose }: { onClose: () => void }) {
  return <Dialogues kind="lyr" onClose={onClose} />
}
