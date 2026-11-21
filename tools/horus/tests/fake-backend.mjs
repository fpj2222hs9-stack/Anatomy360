// In-memory stand-ins for Supabase (auth + PostgREST rpc/rest) and Gemini, used by the handler tests.
import fs from 'fs';
/**
 * The passages the fake database serves.
 * - On the owner's machine tools/horus/out/passages.json (the PRIVATE department books) is used if it exists.
 * - Everywhere else (GitHub Actions, a fresh checkout) a small synthetic fixture is used: sentences written for the
 *   tests, NOT book text, so the repo never needs the private files. HORUS_TEST_SYNTHETIC=1 forces the fixture.
 */
export function loadPassages() {
  const f = new URL('../out/passages.json', import.meta.url);
  if (!process.env.HORUS_TEST_SYNTHETIC && fs.existsSync(f)) return JSON.parse(fs.readFileSync(f));
  return syntheticPassages();
}
export function syntheticPassages() {
  const mk = (sid, chapter, list) => list.map(([heading, body], i) => ({ sid, src: 'fixture', ord: 0, seq: i, book: 'Synthetic test fixture', chapter, heading, page: String(i + 1), body, boost: 1 }));
  const anatomy = [
    ['Axillary nerve', 'The axillary nerve arises from the posterior cord of the brachial plexus, winds around the surgical neck of the humerus and supplies the deltoid muscle and the teres minor muscle. A branch called the upper lateral cutaneous nerve of the arm carries sensation from the skin over the deltoid.'],
    ['Deltoid muscle', 'The deltoid muscle abducts the arm from fifteen to ninety degrees. Its nerve supply is the axillary nerve, root value C5 and C6. Injury to the axillary nerve after a fracture of the surgical neck of the humerus flattens the shoulder.'],
    ['Brachial plexus', 'The brachial plexus is formed by roots, trunks, divisions and cords. The roots are the ventral rami of C5 to T1, the trunks lie in the posterior triangle of the neck and the cords surround the axillary artery.'],
    ['Scaphoid bone', 'The scaphoid receives its blood supply from branches of the radial artery that enter the bone distally, so a fracture through the waist may cause avascular necrosis of the proximal fragment.'],
    ['Femoral triangle', 'The femoral triangle is bounded by the inguinal ligament, the sartorius and the adductor longus. The contents from lateral to medial are the femoral nerve, the femoral artery, the femoral vein and deep inguinal lymph nodes.'],
    ['Radial nerve', 'The radial nerve supplies the extensor muscles of the arm and forearm. It runs in the spiral groove of the humerus and is injured by fractures of the shaft, causing wrist drop.'],
    ['Ulnar nerve', 'The ulnar nerve passes behind the medial epicondyle, supplies the flexor carpi ulnaris and most small muscles of the hand and gives sensation to the medial one and a half fingers.'],
    ['Median nerve', 'The median nerve passes under the flexor retinaculum in the carpal tunnel and supplies the thenar muscles and the lateral two lumbricals.'],
    ['Musculocutaneous nerve', 'The musculocutaneous nerve pierces the coracobrachialis and supplies the biceps brachii, the brachialis and the coracobrachialis.'],
    ['Inguinal canal', 'The inguinal canal transmits the spermatic cord in the male and the round ligament in the female, with the ilioinguinal nerve lying on the cord.'],
    ['Cubital fossa', 'The cubital fossa contains from medial to lateral the median nerve, the brachial artery, the biceps tendon and the radial nerve.'],
    ['Sciatic nerve', 'The sciatic nerve leaves the pelvis through the greater sciatic foramen below piriformis and divides into tibial and common peroneal nerves in the popliteal fossa.'],
    ['Common peroneal nerve', 'The common peroneal nerve winds around the neck of the fibula; injury causes foot drop and loss of dorsiflexion and eversion.'],
    ['Diaphragm', 'The diaphragm is supplied by the phrenic nerve from C3, C4 and C5; the aortic opening lies at the level of T12.'],
    ['Heart chambers', 'The right atrium receives the superior and inferior venae cavae and the coronary sinus, and the left ventricle has the thickest wall.'],
    ['Coronary arteries', 'The right coronary artery supplies the sinoatrial node in most people, and the left anterior descending artery supplies the anterior interventricular septum.'],
    ['Cranial nerves', 'The facial nerve leaves the skull through the stylomastoid foramen and supplies the muscles of facial expression; the vagus nerve passes through the jugular foramen.'],
    ['Cavernous sinus', 'The cavernous sinus contains the internal carotid artery and the abducent nerve, while the oculomotor, trochlear and ophthalmic nerves lie in its lateral wall.'],
    ['Portal system', 'The portal vein is formed behind the neck of the pancreas by the union of the superior mesenteric vein and the splenic vein.'],
    ['Kidney relations', 'The right kidney lies lower than the left because of the liver, and the renal vein lies in front of the renal artery at the hilum.'],
    ['Foregut', 'The celiac trunk supplies the foregut: the stomach, the upper duodenum, the liver, the spleen and the upper pancreas.'],
    ['Rotator cuff', 'The rotator cuff includes the supraspinatus, infraspinatus, teres minor and subscapularis, which hold the head of the humerus in the glenoid cavity.'],
    ['Knee joint', 'The anterior cruciate ligament stops the tibia sliding forward, and the medial meniscus is attached to the medial collateral ligament.'],
    ['Hip joint', 'The blood supply of the femoral head comes mainly from the medial circumflex femoral artery, so a femoral neck fracture risks avascular necrosis.'],
    ['Vertebral column', 'A typical lumbar vertebra has a large body and no foramen transversarium, and the spinal cord ends at the level of L1 or L2 in the adult.'],
    ['Pelvic floor', 'The levator ani supports the pelvic organs and is supplied by the nerve to levator ani and the pudendal nerve.'],
    ['Pharyngeal arches', 'The first pharyngeal arch gives the muscles of mastication and its nerve is the mandibular division of the trigeminal nerve.'],
    ['Thoracic duct', 'The thoracic duct begins at the cisterna chyli, ascends through the aortic opening and drains into the junction of the left subclavian and internal jugular veins.'],
    ['Palmar arches', 'The superficial palmar arch is formed mainly by the ulnar artery and the deep palmar arch by the radial artery.'],
    ['Lymph of breast', 'Most lymph from the breast drains to the axillary nodes, and the lateral thoracic vessels follow the lateral border of pectoralis minor.'],
  ];
  const biochem = [
    ['Glycolysis', 'Glycolysis converts glucose to pyruvate in the cytoplasm; phosphofructokinase one is the key regulated enzyme and is inhibited by ATP and citrate.'],
    ['Urea cycle', 'The urea cycle disposes of ammonia in the liver; carbamoyl phosphate synthetase one is activated by N acetylglutamate and ornithine transcarbamylase deficiency is the commonest defect.'],
    ['Heme synthesis', 'Heme synthesis starts with delta aminolevulinic acid synthase, which is inhibited by heme, and lead poisoning blocks ferrochelatase and ALA dehydratase.'],
    ['Fatty acid oxidation', 'Carnitine carries long chain fatty acids into mitochondria for beta oxidation, and malonyl CoA inhibits carnitine acyltransferase one.'],
    ['Glycogen storage', 'Von Gierke disease is a deficiency of glucose six phosphatase causing fasting hypoglycemia, lactic acidosis and hepatomegaly.'],
    ['Cholesterol', 'HMG CoA reductase is the rate limiting enzyme of cholesterol synthesis and is inhibited by statins.'],
    ['Vitamin B12', 'Vitamin B12 deficiency causes megaloblastic anemia with raised methylmalonic acid, and requires intrinsic factor for absorption in the terminal ileum.'],
    ['DNA repair', 'Xeroderma pigmentosum is caused by a defect in nucleotide excision repair of pyrimidine dimers made by ultraviolet light.'],
  ];
  const histo = [
    ['Simple columnar epithelium', 'Simple columnar epithelium with goblet cells lines the small intestine and has a brush border of microvilli for absorption.'],
    ['Transitional epithelium', 'Transitional epithelium lines the urinary bladder and ureter and its surface cells can flatten when the organ fills.'],
    ['Cartilage', 'Hyaline cartilage matrix contains type two collagen, and its cells called chondrocytes sit in lacunae.'],
    ['Bone', 'An osteon has concentric lamellae around a Haversian canal, and osteoclasts resorb bone in Howship lacunae.'],
    ['Thyroid', 'Thyroid follicles are lined by cuboidal cells and filled with colloid, and parafollicular cells make calcitonin.'],
    ['Liver lobule', 'A classic liver lobule has a central vein and portal triads at the corners with sinusoids lined by Kupffer cells.'],
  ];
  const physio = [
    ['Cardiac output', 'Cardiac output equals stroke volume multiplied by heart rate and rises with increased venous return according to the Frank Starling law.'],
    ['Action potential', 'The upstroke of a nerve action potential is due to opening of voltage gated sodium channels, and repolarization is due to potassium efflux.'],
    ['Renal clearance', 'Inulin clearance measures the glomerular filtration rate because it is freely filtered and neither secreted nor reabsorbed.'],
    ['Oxygen dissociation', 'The oxygen hemoglobin curve shifts to the right with raised carbon dioxide, acidity, temperature and two three diphosphoglycerate.'],
    ['Gastric secretion', 'Parietal cells secrete hydrochloric acid and intrinsic factor, and gastrin stimulates acid secretion.'],
    ['Thyroid hormone', 'Thyroxine raises basal metabolic rate and is controlled by thyroid stimulating hormone through negative feedback.'],
  ];
  return [].concat(mk('anatomy', 'Fixture', anatomy), mk('biochemistry', 'Fixture', biochem), mk('histology', 'Fixture', histo), mk('physiology', 'Fixture', physio));
}
export function makeBackend(opts) {
  opts = opts || {};
  const rows = loadPassages();
  rows.forEach((r, i) => { r.id = i + 1; });
  const st = { usage: new Map(), cache: new Map(), calls: [], geminiBodies: [], gemini: [], restFail: !!opts.restFail, users: new Map(), cacheRead: 0 };
  st.users.set('tok-ana', 'user-ana'); st.users.set('tok-bob', 'user-bob');
  st.script = []; // queue of gemini behaviours: function(body, n) -> {status, text} | undefined (default behaviour)
  const J = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'content-type': 'application/json' } });
  async function fakeFetch(u, init) {
    u = String(u); init = init || {};
    const h = init.headers || {};
    const body = init.body ? JSON.parse(init.body) : null;
    if (u.includes('/auth/v1/user')) {
      const t = String(h.authorization || '').replace(/^Bearer /, '');
      st.calls.push('auth');
      if (!st.users.has(t)) return J({ msg: 'bad jwt' }, 401);
      return J({ id: st.users.get(t), email: 'x@example.invalid' });
    }
    if (u.includes('/rest/v1/rpc/')) {
      if (h.apikey !== 'sb_secret_test') return J({ message: 'bad key' }, 401);
      const name = u.split('/rpc/')[1];
      st.calls.push(name);
      if (name === 'horus_take') {
        const k = body.p_scope + '|' + body.p_day, n = st.usage.get(k) || 0;
        if (body.p_limit < 1 || n >= body.p_limit) return J(-1);
        st.usage.set(k, n + 1); return J(n + 1);
      }
      if (name === 'horus_give_back') { const k = body.p_scope + '|' + body.p_day; st.usage.set(k, Math.max(0, (st.usage.get(k) || 0) - 1)); return new Response(null, { status: 204 }); }
      if (name === 'horus_peek') return J(st.usage.get(body.p_scope + '|' + body.p_day) || 0);
      if (name === 'horus_cache_get') { const v = st.cache.get(body.p_key); if (v) { st.cacheRead++; return J(v.ans); } return new Response('null', { status: 200 }); }
      if (name === 'horus_cache_put') { st.cache.set(body.p_key, { ans: body.p_ans, kind: body.p_kind, q: body.p_q }); return new Response(null, { status: 204 }); }
      return J({ message: 'unknown rpc' }, 404);
    }
    if (u.includes('/rest/v1/horus_passages')) {
      st.calls.push('passages');
      if (st.restFail) return J({ message: 'down' }, 500);
      const sid = /sid=eq\.(\w+)/.exec(u)[1];
      return J(rows.filter(r => r.sid === sid).sort((a, b) => a.ord - b.ord || a.seq - b.seq));
    }
    if (u.includes('generativelanguage.googleapis.com')) {
      const model = /models\/([^:]+):/.exec(u)[1];
      st.geminiBodies.push({ model, body, key: h['x-goog-api-key'], url: u });
      const n = st.geminiBodies.length;
      const sys = body.systemInstruction.parts[0].text;
      const last = body.contents[body.contents.length - 1].parts[0].text;
      let r;
      for (const f of st.script) { r = f({ model, sys, last, body, n }); if (r) break; }
      if (!r) r = defaultReply({ sys, last });
      if (r.status && r.status !== 200) return new Response(r.text || 'err', { status: r.status });
      return J({ candidates: [{ content: { parts: [{ text: r.text }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 200, totalTokenCount: 1200 } });
    }
    return J({ message: 'unrouted ' + u }, 500);
  }
  function defaultReply({ sys, last }) {
    if (sys.startsWith('You convert')) return { text: JSON.stringify({ k: 'axillary nerve deltoid shoulder' }) };
    if (/OUTPUT: return ONLY[\s\S]*"letter"/.test(sys)) return { text: JSON.stringify({ topic: 'medical', grounded: /\[1\] Book:/.test(last), letter: 'B', answer: 'بص يا دكترة، الإجابة B هي الصح لأن الفكرة الأساسية موجودة في الكتاب، والباقي غلط.', cite: [1] }) };
    return { text: JSON.stringify({ topic: 'medical', grounded: /\[1\] Book:/.test(last), answer: 'بص يا دكترة، الفكرة هنا إن الـ structure ده بيتغذّى بالـ nerve المناسب، وده اللي الكتاب بيقوله.', cite: [1] }) };
  }
  return { st, fetch: fakeFetch, rows };
}
export const ENV = (over) => {
  const m = Object.assign({ SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_SECRET_KEYS: '{"default":"sb_secret_test"}', SUPABASE_PUBLISHABLE_KEYS: '{"default":"sb_publishable_test"}', GEMINI_API_KEY: 'AIzaSyFAKE-KEY-FOR-TESTS', HORUS_DEV: '1' }, over || {});
  return k => m[k];
};
export const req = (method, body, o) => {
  o = o || {};
  const headers = { 'content-type': 'application/json', origin: o.origin || 'https://fpj2222hs9-stack.github.io' };
  if (o.token !== null) headers.authorization = 'Bearer ' + (o.token || 'tok-ana');
  return new Request('https://proj.supabase.co/functions/v1/horus' + (o.query || ''), { method, headers, body: body ? JSON.stringify(body) : undefined });
};
