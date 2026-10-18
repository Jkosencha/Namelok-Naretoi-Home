-- Starting content for the website: the stories and gallery photos it shows today.
-- Run once after schema.sql (SQL Editor → paste → Run). Safe to re-run: existing rows are kept.

insert into public.stories (slug, title, child_name, age, category, summary, body, image_url, featured, published, sort_order) values
  ('from-risk-to-resilience', $t$From Risk to Resilience$t$, $t$Jackie$t$, '20', 'rescue', $t$At 13, Jackie's father planned to circumcise her and marry her to an elderly man for cattle. Namelok took her in and kept her in school, and she went on to graduate from university.$t$, $t$One morning, on my way to work, I saw a young girl in traditional Maasai attire crying. Concerned, I invited her into my office to understand what was troubling her. Through her tears, she shared a heart-wrenching story: her father was planning to circumcise her and marry her off to an elderly man in exchange for cattle and money to pay for her brother's school fees. At just 13 years old, her dreams of continuing her education were at risk. Her plea was simple but powerful, she wanted to stay in school and avoid an early marriage. She yearned for a future shaped by education, not cultural practices imposed on her at such a young age. At Namelok Naretoi, we knew we had to act. We took her under our care, reported the case to the divisional office, and ensured she was safely enrolled back in school. Her parents, steeped in traditional beliefs and struggling with poverty, were initially hostile and couldn't see the value in educating a girl. Despite these challenges, the girl thrived under Namelok’s support system. She excelled in her studies, demonstrating unwavering determination to learn. Over time, she graduated from school and secured a place at the university. Her success became a turning point for her family, who eventually realized the error in their ways. They approached Namelok with heartfelt apologies, admitting their actions were driven by ignorance and financial hardship. When the girl graduated from university, it was a monumental moment. Her family, once opposed to her education, celebrated her success with joyous songs, dancing, and communal gatherings. What was once a story of despair turned into a beacon of hope and transformation. Her journey is a testament to the impact of Namelok Naretoi’s mission, highlighting how one act of intervention can ripple through a community, changing perceptions and creating opportunities for future generations. Through her resilience and the support of Namelok, she turned a potential tragedy into a story of empowerment and triumph.$t$, 'images/web/thumbs/sch7.jpg', false, true, 1),
  ('beyond-the-diagnosis', $t$Beyond the Diagnosis$t$, $t$Susan$t$, '8', 'disability', $t$Born with multiple congenital contractures, Susan was feared and rejected. Surgery funded through Namelok and Wellspring International, and ongoing rehabilitation, mean she now walks.$t$, $t$Susan Nenkai entered the world on October 31st, 2017, at 9:00 PM, at Entasekera Health Centre. Her mother, a seventh-grade dropout, faced uncertainty upon Susan's birth. Nurses at the facility, unsure how to handle the child's multiple disabilities, urged family members to visit. Fearing curses or witchcraft, the family was distressed by Susan's condition.

Witnessing Susan's challenges for the first time, I, too, felt overwhelmed. Despite the uncertainty, I offered support and reassurance to the family, emphasizing reliance on faith and exploring available options. Through conversations with Susan's mother, who felt stigmatized and frightened, I encouraged her to embrace her role in caring for her daughter, eventually convincing her to breastfeed.

Namelok Naretoi proposed funding Susan's surgery, with financial backing from Wellspring International. This intervention transformed Susan's life and that of her mother. Initially met with skepticism, Susan's ability to walk and integrate into society astonished her community. Through ongoing medical rehabilitation, Susan has blossomed into a joyful, beautiful girl, albeit with continued clinical oversight.

Looking ahead, Namelok seeks support for Susan's education once she reaches school age. We hope Wellspring will consider aiding her in the future. Sadly, Susan's father, unable to accept her disability, abandoned her to her grandmother's care, despite her mother being married.

Without the intervention of Wellspring through Namelok Naretoi, Susan would have likely faced a dire fate. Her young mother, still in school, initially rejected the child, and the family lacked the means to provide necessary care. Gratitude is extended to Wellspring, with blessings upon their team, for bringing a smile to Susan's face. The narrative of rejection surrounding Susan has been completely overturned.$t$, 'images/web/thumbs/hsp3.jpg', false, true, 2),
  ('running-toward-school', $t$Running Toward School$t$, $t$Vivian$t$, '15', 'rescue', $t$An orphan who had just earned a place in secondary school fled FGM and a forced marriage. She remembered Namelok from a school awareness visit, and we gave her a scholarship so she could keep learning.$t$, $t$On the evening of December 12, 2023, at approximately 7:30 pm, a 15-year-old Maasai girl sought refuge at Namelok Naretoi Home, visibly distressed. Extending a warm welcome, I received her, and once she had composed herself, she shared her poignant narrative. This young girl, an orphan, lost her mother during her early childhood, and her father, facing mental health challenges, left home. Subsequently, she and three brothers were taken in by one of their uncles, who assumed responsibility for their care. Enrolled in a local primary school near her home, she diligently pursued her studies, culminating in her final exams in October 2023, with aspirations to join high school. Upon receiving the exam results, her joy at securing admission to secondary school swiftly transformed into anguish. Disturbingly, she learned that her uncle, in exchange for numerous cattle, intended to subject her to female genital mutilation (FGM) and subsequently marry her off to an elderly affluent man. This grim revelation left the girl grappling with thoughts of suicide, torn between the oppressive cultural norms and her desperate need for escape. Recalling an organization called Namelok Naretoi, which she had encountered during an awareness program at her local school, she made the courageous decision to flee, ultimately finding refuge at Namelok. Recognizing the severity of the situation, Namelok Naretoi decided to provide a scholarship for the girl, ensuring her continued education. The organization reported the case to the local chief and government officer, who expressed gratitude to Namelok for its support and pledged protection in the face of any potential threats. The girl, now filled with gratitude, envisions a brighter future, promising to complete her education and return to serve her community.$t$, 'images/web/sch6.jpg', true, true, 3)
on conflict (slug) do nothing;

-- Gallery: only added if the gallery is still empty
insert into public.gallery_photos (image_url, caption, category, published, sort_order)
select * from (values
  ('images/nam10.jpg', $t$A caregiver with children at the home$t$, 'home', true, 1),
  ('images/web/sch4.jpg', $t$Handing out sanitary pads at a school$t$, 'school', true, 2),
  ('images/hsp3.jpg', $t$A medical worker fitting a leg brace$t$, 'health', true, 3),
  ('images/nam2.jpg', $t$Children in football kits at the home$t$, 'home', true, 4),
  ('images/web/sch1.jpg', $t$Pupils gathered for a school visit$t$, 'school', true, 5),
  ('images/nam5.jpg', $t$A child in a wheelchair with a caregiver$t$, 'health', true, 6),
  ('images/nam3.jpg', $t$Staff and children outside the home$t$, 'home', true, 7),
  ('images/namelokBG2.jpg', $t$Girls celebrating their new sanitary pads$t$, 'school', true, 8),
  ('images/hsp1.jpg', $t$Children and mothers on the way to hospital$t$, 'health', true, 9),
  ('images/nam4.jpg', $t$Children sharing a meal outdoors$t$, 'home', true, 10),
  ('images/web/sch2.jpg', $t$Students listening during an awareness talk$t$, 'school', true, 11),
  ('images/hsp2.jpg', $t$A boy walking on crutches after treatment$t$, 'health', true, 12),
  ('images/nam6.jpg', $t$A workshop with young people$t$, 'home', true, 13),
  ('images/web/sch3.jpg', $t$Pupils in class during a school visit$t$, 'school', true, 14),
  ('images/aboutUs3.jpg', $t$Children in wheelchairs with Namelok staff$t$, 'health', true, 15),
  ('images/nam7.jpg', $t$Children gathered outside the home$t$, 'home', true, 16),
  ('images/aboutUs2.jpg', $t$Pupils with boxes of donations$t$, 'school', true, 17),
  ('images/child5.jpg', $t$A caregiver doing therapy with a toddler$t$, 'health', true, 18),
  ('images/nam8.jpg', $t$Children in the compound$t$, 'home', true, 19),
  ('images/web/sch5.jpg', $t$A school assembly during an awareness programme$t$, 'school', true, 20),
  ('images/hsp4.jpg', $t$A child on crutches beside the Namelok vehicle$t$, 'health', true, 21),
  ('images/nam9.jpg', $t$Children playing football$t$, 'home', true, 22),
  ('images/web/sch6.jpg', $t$Donations at a school awareness programme$t$, 'school', true, 23),
  ('images/child2.jpg', $t$Two girls at school, one walking with a crutch$t$, 'health', true, 24),
  ('images/web/nam1.jpg', $t$Children at the home$t$, 'home', true, 25),
  ('images/namelokBG.jpg', $t$Pupils holding donated pads$t$, 'school', true, 26),
  ('images/child7.jpg', $t$A child using a standing frame$t$, 'health', true, 27),
  ('images/aboutUs.jpg', $t$A selfie with the children$t$, 'home', true, 28),
  ('images/sch7.jpg', $t$Girls lined up at a school visit$t$, 'school', true, 29),
  ('images/child4.jpg', $t$A child standing during rehabilitation$t$, 'health', true, 30),
  ('images/web/mama.jpg', $t$A Maasai mother in traditional dress$t$, 'home', true, 31),
  ('images/web/img.4.jpg', $t$A football match at a school visit$t$, 'school', true, 32),
  ('images/child8.jpg', $t$A toddler in recovery$t$, 'health', true, 33),
  ('images/web/namelokBG3.jpg', $t$A community gathering at Namelok$t$, 'home', true, 34),
  ('images/child1.jpg', $t$A child at the home$t$, 'health', true, 35)
) as v (image_url, caption, category, published, sort_order)
where not exists (select 1 from public.gallery_photos);
