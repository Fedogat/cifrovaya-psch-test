export type TopicResult={topic_id:string;topic_number:string;topic_title:string;subject_name:string;score:number;total:number;grade:number};
export type SubjectResult={subject_name:string;theory_index:number|null;average_grade:number};
export type QuarterlyResult={average_grade?:number|null;topic_results?:TopicResult[]|null;subject_results?:SubjectResult[]|null};
export default function QuarterlyTestResult({result}:{result:QuarterlyResult}){
 if(result.average_grade==null)return null;
 return <div style={{width:'100%',overflowX:'auto',gridColumn:'1 / -1'}}><p><b>Средняя оценка по темам: {Number(result.average_grade).toLocaleString('ru-RU',{maximumFractionDigits:2})}</b></p><details><summary>Оценки по темам и предметам</summary><table aria-label="Результаты по темам квартального зачёта" style={{width:'100%',textAlign:'left',borderSpacing:'8px'}}><thead><tr><th>Тема</th><th>Правильно</th><th>Оценка</th></tr></thead><tbody>{result.topic_results?.map(t=><tr key={t.topic_id}><td>{t.topic_number} · {t.topic_title}<small style={{display:'block'}}>{t.subject_name}</small></td><td>{t.score} из {t.total}</td><td>{t.grade}</td></tr>)}</tbody></table>{result.subject_results?.map((s,i)=><p key={i}>{s.subject_name}: <b>{Number(s.average_grade).toLocaleString('ru-RU',{maximumFractionDigits:2})}</b>{s.theory_index==null?' — нет соответствующего столбца в ведомости':''}</p>)}</details></div>;
}

