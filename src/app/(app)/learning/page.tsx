'use client'
import { useState, useEffect, useCallback } from 'react'
import { Search, BookOpen, Play, Star, Clock, Users, Filter, ChevronRight, CheckCircle } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { createClient } from '@/lib/supabase/client'

const CATEGORIES = ['All','Investing','Budgeting','Real Estate','Crypto','Retirement','Tax Strategy','Business']

export default function LearningPage() {
  const [courses, setCourses] = useState<any[]>([])
  const [enrollments, setEnrollments] = useState<Record<string,any>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [tab, setTab] = useState<'all'|'enrolled'|'completed'>('all')
  const [enrolling, setEnrolling] = useState<string|null>(null)

  const load = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: c }, { data: e }] = await Promise.all([
        supabase.from('courses').select('*').order('created_at', { ascending: false }),
        supabase.from('course_enrollments').select('*').eq('user_id', user.id),
      ])
      setCourses(c ?? [])
      const map: Record<string,any> = {}
      for (const en of (e ?? [])) map[en.course_id] = en
      setEnrollments(map)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleEnroll = async (courseId: string) => {
    setEnrolling(courseId)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { error } = await supabase.from('course_enrollments').insert({ user_id: user.id, course_id: courseId, progress_pct: 0, status: 'enrolled' })
      if (!error) {
        setEnrollments(e => ({ ...e, [courseId]: { course_id: courseId, progress_pct: 0, status: 'enrolled' } }))
      }
    } catch(e) { console.error(e) }
    finally { setEnrolling(null) }
  }

  const filtered = courses.filter(c => {
    const matchSearch = search === '' || c.title?.toLowerCase().includes(search.toLowerCase()) || c.instructor_name?.toLowerCase().includes(search.toLowerCase())
    const matchCat = category === 'All' || c.category === category
    const enrollment = enrollments[c.id]
    const matchTab = tab === 'all' || (tab === 'enrolled' && enrollment && enrollment.status === 'enrolled') || (tab === 'completed' && enrollment?.status === 'completed')
    return matchSearch && matchCat && matchTab
  })

  return (
    <div className="page-container fade-in">
      <PageHeader title="Learning" description="Build your financial knowledge" />

      {/* Stats Row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 }}>
        {[
          { label:'Courses Available', value:courses.length },
          { label:'Enrolled', value:Object.values(enrollments).filter((e:any) => e.status==='enrolled').length },
          { label:'Completed', value:Object.values(enrollments).filter((e:any) => e.status==='completed').length },
          { label:'Certificates', value:Object.values(enrollments).filter((e:any) => e.certificate_url).length },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding:'14px 18px' }}>
            <div style={{ fontSize:24, fontWeight:700, letterSpacing:'-0.02em', marginBottom:2 }}>{s.value}</div>
            <div style={{ fontSize:12, color:'var(--text-tertiary)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:12, marginBottom:20, alignItems:'center', flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:'1', minWidth:200 }}>
          <Search size={14} color="var(--text-tertiary)" style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)' }}/>
          <input className="input-field" style={{ paddingLeft:36 }} placeholder="Search courses..." value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <div style={{ display:'flex', gap:2, background:'var(--bg-secondary)', borderRadius:12, padding:3, border:'1px solid var(--border)' }}>
          {(['all','enrolled','completed'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding:'6px 14px', borderRadius:9, fontSize:12, fontWeight:500, background:tab===t?'var(--bg-tertiary)':'transparent', color:tab===t?'var(--text-primary)':'var(--text-secondary)', border:'none', cursor:'pointer', textTransform:'capitalize' }}>{t}</button>
          ))}
        </div>
      </div>

      {/* Category Pills */}
      <div style={{ display:'flex', gap:8, marginBottom:20, overflowX:'auto', paddingBottom:4 }}>
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setCategory(cat)} style={{ padding:'6px 14px', borderRadius:20, fontSize:12, fontWeight:500, background:category===cat?'var(--green-400)':' var(--bg-secondary)', color:category===cat?'#000':'var(--text-secondary)', border:category===cat?'none':'1px solid var(--border)', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
            {cat}
          </button>
        ))}
      </div>

      {/* Courses Grid */}
      {loading ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="card" style={{ padding:0, overflow:'hidden' }}>
              <div style={{ height:140, background:'var(--bg-tertiary)', animation:'pulse 1.5s ease-in-out infinite' }}/>
              <div style={{ padding:16 }}>
                <div style={{ height:14, background:'var(--bg-tertiary)', borderRadius:4, marginBottom:8, animation:'pulse 1.5s ease-in-out infinite' }}/>
                <div style={{ height:12, background:'var(--bg-tertiary)', borderRadius:4, width:'60%', animation:'pulse 1.5s ease-in-out infinite' }}/>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 20px' }}>
          <BookOpen size={40} color="var(--text-quaternary)"/>
          <p style={{ color:'var(--text-tertiary)', marginTop:10 }}>No courses found.</p>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
          {filtered.map(course => {
            const enrollment = enrollments[course.id]
            const isEnrolled = !!enrollment
            const isCompleted = enrollment?.status === 'completed'
            const progress = enrollment?.progress_pct ?? 0
            return (
              <div key={course.id} className="card" style={{ overflow:'hidden', display:'flex', flexDirection:'column' }}>
                {/* Thumbnail */}
                <div style={{ height:130, background:course.thumbnail_url?`url(${course.thumbnail_url}) center/cover`:'linear-gradient(135deg,rgba(48,209,88,0.2),rgba(10,132,255,0.2))', position:'relative', flexShrink:0 }}>
                  <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {!course.thumbnail_url && <BookOpen size={36} color="rgba(48,209,88,0.6)"/>}
                  </div>
                  {course.is_free && <div style={{ position:'absolute', top:8, left:8, background:'var(--green-400)', color:'#000', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:6 }}>FREE</div>}
                  {isCompleted && <div style={{ position:'absolute', top:8, right:8, width:28, height:28, borderRadius:'50%', background:'var(--green-400)', display:'flex', alignItems:'center', justifyContent:'center' }}><CheckCircle size={16} color="#000"/></div>}
                </div>
                <div style={{ padding:16, flex:1, display:'flex', flexDirection:'column' }}>
                  <div style={{ fontSize:11, color:'var(--text-tertiary)', marginBottom:4 }}>{course.category}</div>
                  <div style={{ fontSize:14, fontWeight:600, lineHeight:1.3, marginBottom:6, flex:1 }}>{course.title}</div>
                  <div style={{ fontSize:12, color:'var(--text-tertiary)', marginBottom:10 }}>{course.instructor_name}</div>
                  <div style={{ display:'flex', gap:12, marginBottom:12 }}>
                    {course.rating && <span style={{ fontSize:11, display:'flex', alignItems:'center', gap:3, color:'var(--text-tertiary)' }}><Star size={11} color="var(--text-yellow)" fill="var(--text-yellow)"/>{course.rating?.toFixed(1)}</span>}
                    {course.duration_hours && <span style={{ fontSize:11, color:'var(--text-tertiary)', display:'flex', alignItems:'center', gap:3 }}><Clock size={11}/>{course.duration_hours}h</span>}
                    {course.lesson_count && <span style={{ fontSize:11, color:'var(--text-tertiary)', display:'flex', alignItems:'center', gap:3 }}><BookOpen size={11}/>{course.lesson_count} lessons</span>}
                  </div>
                  {isEnrolled && !isCompleted && (
                    <div style={{ marginBottom:10 }}>
                      <div style={{ height:3, background:'var(--bg-tertiary)', borderRadius:2, overflow:'hidden', marginBottom:3 }}>
                        <div style={{ height:'100%', width:`${progress}%`, background:'var(--green-400)', borderRadius:2 }}/>
                      </div>
                      <div style={{ fontSize:10, color:'var(--text-tertiary)' }}>{progress}% complete</div>
                    </div>
                  )}
                  <button
                    className={isCompleted ? 'btn btn-secondary btn-sm' : 'btn btn-green btn-sm'}
                    style={{ width:'100%', justifyContent:'center' }}
                    onClick={() => !isEnrolled && handleEnroll(course.id)}
                    disabled={enrolling===course.id}
                  >
                    {isCompleted ? (<><CheckCircle size={13}/> Completed</>) : isEnrolled ? (<><Play size={13}/> Continue</>) : enrolling===course.id ? 'Enrolling...' : (<><Play size={13}/> {course.is_free?'Start Free':'Enroll'}</>)}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  )
}
