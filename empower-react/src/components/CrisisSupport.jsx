// Reusable crisis-support card. Surfaced wherever a user signals very low mood, so help is
// never more than one tap away (previously the only crisis line lived inside one perimenopause
// article). 988 is the Suicide and Crisis Lifeline, call or text, free, 24/7, in both Canada
// (live since Nov 2023) and the US. Tone is validating, never alarming.
export default function CrisisSupport({ style }) {
  return (
    <div style={{ background:'#f0f0f8', border:'1px solid #d6d6ea', borderRadius:12, padding:'13px 15px', marginBottom:16, ...style }}>
      <div style={{ fontSize:13, color:'#3a3550', lineHeight:1.65 }}>
        Low mood and anxiety can be a genuine hormonal effect, and they also matter on their own. If things feel heavy, you do not have to carry it alone.
      </div>
      <div style={{ fontSize:13, color:'#3a3550', lineHeight:1.65, marginTop:8 }}>
        <a href="tel:988" style={{ color:'#3a3550', fontWeight:700, textDecoration:'underline' }}>Call or text 988</a>, the Suicide and Crisis Lifeline. Free and available 24/7 in Canada and the US.
      </div>
    </div>
  )
}
