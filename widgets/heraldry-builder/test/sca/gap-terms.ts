// Term lists for the SCA gap tagger (gaps.ts), written for this project from the words that occur in
// the O&A blazons. Entries are singular, lower-case, accent-free lemmas (the tagger strips plural
// endings before lookup); hyphenated terms are single tokens. Where a word is in more than one list,
// gaps.ts decides by the order it loads them in.

import { CHARGE_IDS, NAMED_TINCTURE_CHARGES, SEMY_NAMES, SEMY_SPELLINGS, VARIATION_SPELLINGS, type ChargeId } from '../../src/lib/heraldry';

/** Space-separated words → array (keeps the lists compact). */
const w = (s: string): string[] => s.trim().split(/\s+/);

/** Words mapped to themselves as sub-tags. */
const same = (s: string): [string, string][] => w(s).map((x) => [x, x]);

// ── Charges ─────────────────────────────────────────────────────────────────

/** Charge buckets: each is a gap category `charge-<bucket>`. */
export const CHARGE_BUCKETS = [
  'beast', 'bird', 'monster', 'fish', 'reptile', 'insect', 'human', 'plant', 'celestial', 'weapon', 'tool',
  'household', 'clothing', 'instrument', 'building', 'ship', 'nature', 'cross', 'geometric', 'symbol',
] as const;
export type ChargeBucket = (typeof CHARGE_BUCKETS)[number];

export const BUCKET_DESCRIPTION: Record<ChargeBucket, string> = {
  beast: 'a natural beast other than the lion, wolf, boar, stag, goat and hare (bear, cat, horse, deer…), or a beast\'s head or limb',
  bird: 'a bird other than the eagle and owl, a bird\'s head or limb, or a wing or feather',
  monster: 'a heraldic monster other than the unicorn and dragon (griffin, wyvern, sea-creatures…)',
  fish: 'a named fish, sea mammal, crustacean or shell (dolphin, whale, escallop…)',
  reptile: 'a reptile or amphibian (serpent, lizard, turtle, frog…)',
  insect: 'an insect, arachnid or other invertebrate other than the bee',
  human: 'a human figure or body part (hand, arm, skull, eye…)',
  plant: 'a flower, leaf, fruit, foil, named tree or other plant other than the rose, tree and fleur-de-lis',
  celestial: 'a celestial or weather charge other than the sun, mullet and crescent (estoile, moon, cloud…)',
  weapon: 'a weapon or piece of armour other than the sword',
  tool: 'a tool, implement or piece of equipment other than the key and gear',
  household: 'a vessel, container, food, furniture, light, jewel, game piece, flag or other object',
  clothing: 'an article of clothing',
  instrument: 'a musical instrument or bell',
  building: 'a building or architectural element',
  ship: 'a ship, boat or part of one',
  nature: 'a landform, rock, water, fire or other natural feature',
  cross: 'a cross used as a charge (couped, crosslet, formy, Maltese…) rather than the cross ordinary',
  geometric: 'a geometric charge or sub-ordinary used as a charge (annulet, roundel, lozenge, billet…)',
  symbol: 'a knot, letter, rune, triskelion or other abstract symbol',
};

/** Charge nouns the widget lacks, by bucket. */
export const GAP_CHARGES: Record<ChargeBucket, string[]> = {
  beast: w(`
    bear grizzly cat lioness tiger leopard panther catamount lynx ounce wildcat cougar puma jaguar cheetah kitten
    horse stallion mare pony foal colt donkey ass mule zebra dog talbot greyhound hound wolfhound bloodhound mastiff
    terrier poodle corgi brachet alaunt lymer spaniel dane samoyed cur husky collie dachshund retriever setter beagle fox vixen jackal hyena coyote coney rabbit squirrel
    elephant bull ox cow calf bison buffalo yak ram sheep lamb ewe badger brock hedgehog urchin otter sea-otter weasel
    stoat ferret marten mink polecat wolverine mouse rat shrew mole vole hamster bat reremouse monkey ape baboon
    gorilla camel dromedary camelopard cameleopard giraffe deer buck hart hind doe fawn roe elk moose reindeer
    caribou ibex gazelle pig sow hog piglet beaver raccoon skunk opossum possum aardvark anteater armadillo kangaroo
    wombat koala llama alpaca capybara hippopotamus rhinoceros seal walrus panda porcupine sloth cub beast
    attire antler massacre jambe jamb gamb gambe paw scalp
  `),
  bird: w(`
    raven swan falcon hawk dove peacock peahen crane heron stork martlet alerion popinjay parrot cock rooster hen
    chicken crow corbie rook magpie jay goose duck drake swallow sparrow wren robin lark skylark nightingale
    blackbird thrush finch goldfinch linnet tit kingfisher hummingbird pelican ostrich emu penguin puffin gull
    seagull tern osprey kestrel merlin peregrine gyrfalcon vulture condor kite ibis flamingo chough cockatoo quail
    pheasant partridge grouse moorcock turkey loon egret cormorant albatross woodpecker starling cardinal jackdaw
    pigeon bluebird songbird corvid dodo eaglet owlet bird wing vol feather quill plume nest egg
  `),
  monster: w(`
    griffin gryphon griffon phoenix wyvern wivern pegasus cockatrice basilisk sea-lion sealion sea-horse seahorse
    sea-unicorn sea-wolf seawolf sea-dog seadog sea-dragon seadragon sea-serpent sea-goat seagoat sea-stag
    sea-griffin sea-cat sea-bear sea-fox sea-boar sea-pegasus sea-coney sea-catamount sea-pithon sea-tyger
    pithon kraken mermaid merman melusine siren triton harpy centaur sagittary satyr sphinx manticore enfield alphyn
    yale opinicus chimera hydra hippogriff simurgh senmurv firebird roc tyger calygreyhound amphisbaena salamander
    lion-dragon chatloup ypotryll zydrach troll demon devil gorgon frauenadler musimon antelope pantheon bagwyn wurm
    lindwurm qilin kirin baku tengu kitsune east-asian-dragon dragonet werewolf bonacon cetus hippocamp lamia
    alicorn monster
  `),
  fish: w(`
    dolphin pike lucy luce salmon trout carp herring hake cod codfish eel whale orca shark catfish swordfish stingray
    manta ray crab lobster crayfish crawfish shrimp prawn octopus polypus squid calamary calamarie nautilus whelk escallop
    scallop shell seashell conch cockle oyster mussel sea-urchin jellyfish starfish sea-nettle sturgeon mackerel
    perch roach bream barbel tench goldfish koi flounder plaice angelfish narwhal manatee haddock sardine anchovy
  `),
  reptile: w(`
    serpent snake adder viper cobra rattlesnake asp python lizard chameleon gecko iguana skink turtle tortoise
    sea-turtle sea-tortoise frog toad newt tadpole crocodile alligator worm
  `),
  insect: w(`
    wasp hornet honeybee bumblebee butterfly moth dragonfly damselfly beetle scarab ladybug ladybird ant emmet
    grasshopper locust cricket mantis fly mosquito cockroach earwig spider scorpion snail slug caterpillar cicada
    firefly flea louse tick spiderweb cobweb web chrysalis cocoon centipede earthworm
  `),
  human: w(`
    man woman maiden lady lord knight archer king queen prince princess monk nun friar bishop pope saint pilgrim
    palmer soldier warrior viking dancer harper jester fool shepherd smith miller baker hunter sailor angel cherub
    seraph savage wodewose giant dwarf elf fairy moor saracen child boy girl figure person head face bust torso
    skull skeleton bone tooth hand arm cubit-arm leg foot fist finger thumb eye ear nose mouth lip beard moustache
    hair tress brain mask footprint handprint foi
  `),
  plant: w(`
    laurel oak wreath garland chaplet bouquet leaf thistle lily lily-of-the-valley lotus water-lily ivy holly vine
    grapevine grape acorn sprig slip branch bough blossom flower floret cinquefoil quatrefoil trefoil sexfoil
    septfoil octofoil foil shamrock clover garb sheaf wheat rye barley oat rice reed bulrush cattail rush fern palm
    pine fir spruce cedar cypress yew ash elm birch beech alder aspen poplar willow linden rowan hazel hawthorn
    maple olive bay mistletoe elder crequier juniper dogwood madrone sycamore ginkgo acanthus bamboo cactus saguaro
    apple pear cherry plum peach lemon orange quince pomegranate fig date strawberry raspberry blackberry berry
    fraise pumpkin gourd turnip carrot onion garlic leek peapod pea bean mushroom toadstool fungus nut walnut
    hazelnut chestnut almond pinecone pine-cone cone seed bulb rosebud garden-rose garden-rosebud tulip iris daisy
    marguerite buttercup peascod sunflower daffodil poppy violet columbine gillyflower carnation lilac lavender heather trillium
    edelweiss dandelion primrose periwinkle foxglove honeysuckle jasmine peony chrysanthemum crocus snowdrop
    marigold magnolia amaranth chamomile pimpernel borage belladonna mandrake wolfsbane hemlock rue sage rosemary
    thyme mint parsley mustard hop flax cotton hemp nettle teazel teasel calla arum orchid wisteria pansy
    heartsease forget-me-not bluebell cornflower harebell tobacco banana pineapple ananas coconut melon chili
    pepper tomato potato cabbage corn maize fruit vegetable artichoke aloe stump trunk log root stalk stem thorn
    bramble briar brier frond spray nesselblatt seeblatt shrub bush sapling hurst grove forest plant herb weed
    seaweed kelp moss
  `),
  celestial: w(`
    star comet moon decrescent increscent lunel sunburst compass-star cloud rainbow lightning
    thunderbolt snowflake raindrop planet wind sunray ray zephyr boreas aeolus mistral half-moon quarter-sun
    constellation eclipse fireball meteor
  `),
  weapon: w(`
    arrow arrowhead pheon broad-arrow broadarrow bolt quarrel quiver axe ax battle-axe battleaxe labrys tomahawk bow
    longbow crossbow spear spearhead lance javelin pikestaff pikehead boarspear halberd poleaxe glaive bill billhook
    bardiche partisan voulge mace morningstar flail warhammer club dagger rapier scimitar sabre saber falchion
    cutlass claymore katana gladius seax dirk kris kriss shamshir cinquedea tulwar flamberge curtana estoc longsword
    knife trident caltrap caltrop grenade cannon gun handgun musket pistol rifle sling catapult trebuchet swepe
    ballista battering-ram chaine-shot skyrocket rocket bomb chakram shuriken boomerang helm helmet armour armor
    gauntlet shield buckler targe chamfron morion cuirass breastplate hauberk
  `),
  tool: w(`
    hammer sledgehammer mallet anvil tongs bellows needle spindle drop-spindle distaff shuttle bobbin spool skein
    yarn clew thimble pin loom comb scissors shears compass compasses caliper calipers square plane chisel saw
    drawknife awl punner trowel wedge nail staple chain rope ladder pick pickaxe shovel spade hoe rake scythe sickle
    plough plow harrow pitchfork millrind fer-de-moline fer-a-loup millstone millwheel waterwheel wheel cartwheel
    catherine-wheel cog mortar pestle balance scales hourglass sundial astrolabe armillary quadrant abacus alembic
    retort crucible lens telescope spectacles eyeglasses eyeglass padlock lock fetterlock manacle shackle
    shacklebolt hook fishhook grapnel net horseshoe bridle bit snaffle-bit stirrup saddle spur rowel spur-rowel
    prickspur hames barnacle yoke brush paintbrush palette pen penner inkwell inkhorn penbox pen-box staff crozier
    crook crutch wand rod stick fleam lancet razor keythong furison grozing crampon crampet scoop noose whip
    scourge lure jess press quintain weight slow-match match tool
  `),
  household: w(`
    cup goblet chalice tankard mug stein beaker mazer drinking-horn cauldron pot fleshpot kettle pan pail bowl ewer
    pitcher jug flagon bottle flask jar urinal amphora vase urn barrel tun cask keg bucket basket beehive skep
    honeycomb chest box coffer casket ark purse pouch bag sack scrip wool-pack woolpack woolsack table chair stool
    curule couch throne bed cradle cushion pillow lamp lantern candle candlestick candelabrum menorah torch
    firebrand beacon brazier cresset andiron mirror handmirror fan parasol umbrella broom besom spoon fork ladle
    cleaver saltcellar salt bread loaf pretzel cheese cake pie fleece hide pelt wool coin money ring necklace
    torc torque brooch gem gemstone jewel pearl coronet eastern-crown antique-crown celestial-crown mural-crown
    naval-crown imperial-crown papal-crown circlet diadem tiara mitre sceptre scepter orb scroll
    escroll card chess-piece chess-rook chess-knight chess-king chess-queen chess-bishop chess-pawn zule die dice
    domino toy ball doll puppet whirligig rattle whistle wagon cart carriage flag banner pennon pennant
    pennoncelle gonfanon gonfalon standard ensign water-bouget bouget cornucopia torse card-pique pique bauble
    glass dish platter tablet thurible censer altar paternoster rosary beads grail keyhole ribbon tassel tub
  `),
  clothing: w(`
    hat cap chapeau hood glove shoe boot slipper sandal maunch maunche sleeve belt girdle buckle cloak mantle robe
    gown tunic shirt breeches trousers stocking hose apron garter collar veil wimple headband turban bycocket
    chaperon bonnet coif kerchief cuff button clog fez mitten scarf
  `),
  instrument: w(`
    harp lute lyre horn hunting-horn bugle bugle-horn trumpet clarion recorder flute pipe bagpipe drum tabor doumbek
    dumbek kettledrum viol viola violin fiddle rebec gittern guitar cittern mandolin oud psaltery dulcimer
    panpipe organ zil cymbal tambourine bell handbell sackbut shawm hautboy crwth harpsichord sistrum shofar
    ocarina quaver clef g-clef
  `),
  building: w(`
    tower castle fortress fort keep turret bridge gate gateway door arch archway column pillar wall church chapel
    cathedral temple mosque pagoda torii house cottage hall barn mill windmill lighthouse tent pavilion yurt well
    weir keystone battlement portcullis dolmen menhir trilithon pyramid obelisk cairn city town dome minaret spire
    steeple chimney roof window stair staircase brick portal
  `),
  ship: w(`
    ship lymphad drakkar longship galley galleon caravel carrack boat knorr hulk canoe rowboat coracle raft barge
    sail mast oar rudder prow yardarm
  `),
  nature: w(`
    mountain hill rock stone crag cave water wave stream river sea lake valley fire ice crystal volcano island
    gurges whirlpool peak cliff waterfall ford
  `),
  cross: w('ankh'),
  geometric: w(`
    guze fountain fusil mascle
    masculyn rustre delf triangle gout goute drop escutcheon inescutcheon hexagon pentagon octagon
    polygon icosahedron cube sphere annulus penannular cartouche cornice escarbuncle gunstone
  `),
  symbol: w(`
    knot triquetra triskelion triskele pentaskelion valknut yin-yang t'ai-chi tomoe mitsutomoe umebachi mon chi-rho
    letter rune algiz tiwaz sowilo theow othala beorc tyr futhark lambda numeral word kanji glyph sigil monogram
    labyrinth spiral swirl schnecke koru xicalcoliuhqui pentacle pentagram hexagram star-of-david awen ermine-spot
    pawprint caduceus staff-of-aesculapius hand-of-fatima hamsa infinity symbol lacy-knot bowen-knot
    stafford-knot wake-knot bourchier-knot cavendish-knot heneage-knot hungerford-knot dacre-knot harrington-knot
    savoy-knot joscelyn-knot
  `),
};

/** SCA words for the widget's own charges → ChargeId: each id, the College's other words for some, and the charges named for their tincture. Any other charge noun is a gap. */
export const SUPPORTED_CHARGE_WORDS: Readonly<Record<string, ChargeId>> = {
  ...Object.fromEntries(CHARGE_IDS.map((id) => [id, id])),
  'fleur-de-lys': 'fleur-de-lis', book: 'open-book', crosslet: 'cross-crosslet',
  ...Object.fromEntries(NAMED_TINCTURE_CHARGES.filter((n) => !n.word.includes(' ')).flatMap((n) => [[n.word, n.charge], [n.plural, n.charge]])),
};

/** Bucket for a compound built on one of the widget's charges ("a lion's head" → beast). */
export const SUPPORTED_CHARGE_BUCKET: Record<ChargeId, ChargeBucket> = {
  lion: 'beast', wolf: 'beast', boar: 'beast', stag: 'beast', goat: 'beast', hare: 'beast', fish: 'fish',
  bee: 'insect', unicorn: 'monster', dragon: 'monster', eagle: 'bird', owl: 'bird', rose: 'plant', tree: 'plant',
  'fleur-de-lis': 'plant', mullet: 'celestial', crescent: 'celestial', sun: 'celestial', heart: 'symbol',
  key: 'tool', 'open-book': 'household', sword: 'weapon', crown: 'household', anchor: 'ship',
  'musical-note': 'symbol', flame: 'nature', gear: 'tool', lightbulb: 'household',
  roundel: 'geometric', annulet: 'geometric', billet: 'geometric', lozenge: 'geometric', goutte: 'geometric',
  'cross-crosslet': 'cross', estoile: 'celestial', spark: 'celestial',
};

/** Parts that make a compound charge after a possessive ("a wolf's head", "a stag's attires"). */
export const PART_WORDS = w(`
  head face mask skull hand jambe jamb gamb paw forepaw leg foreleg foot forefoot tail wing attire antler claw talon
  tusk horn jaw hoof pawprint tooth eye ear tongue beak hide fleece pelt scale feather quill egg nest haunch neck
  body bone arm breast fist trunk mane hair scalp sail stem slip
`);

/** "A group of" words: the charge follows "of" ("a sheaf of arrows", "a pair of wings"). */
export const CONTAINER_WORDS = w('pair sheaf bundle bunch cluster set brace couple handful');

// ── Field, ordinaries, lines ────────────────────────────────────────────────

/** SCA spellings of the widget's ordinaries (the cross is read separately, as it is also a charge). */
export const SUPPORTED_ORDINARY_WORDS: Record<string, string> = {
  fess: 'fess', fesse: 'fess', pale: 'pale', bend: 'bend', 'bend-sinister': 'bend-sinister', chevron: 'chevron',
  saltire: 'saltire', chief: 'chief', bordure: 'bordure', pile: 'pile',
};

/** Ordinaries, sub-ordinaries and diminutives the widget lacks → sub-tag. */
export const GAP_ORDINARIES: Record<string, string> = Object.fromEntries([
  ...same(`canton quarter orle tressure gore gusset flaunch base mount trimount pall shakefork gyron point fret
    label tierce chape bordurelet flasque voider baton riband fillet endorse bar barrulet bendlet scarpe pallet
    chevronel saltorel cotise bendlet-sinister scarpe-sinister`),
  ['gemel', 'gemel'], ['gemelle', 'gemel'], ['scarp', 'scarpe'], ['palet', 'pallet'], ['chevronelle', 'chevronel'],
  ['dance', 'dancette'], ['dancette', 'dancette'], ['fess-point', 'point'], ['chief-pale', 'chief-pale'],
]);

/** Lines of partition → sub-tag. The widget draws only straight lines. */
export const LINES: Record<string, string> = {
  embattled: 'embattled', crenellated: 'embattled', crenelated: 'embattled', battled: 'embattled',
  embattlement: 'embattled', 'counter-embattled': 'embattled-counter-embattled',
  counterembattled: 'embattled-counter-embattled', 'embattled-counterembattled': 'embattled-counter-embattled',
  'embattled-counter-embattled': 'embattled-counter-embattled', bretessed: 'bretessed', bretesse: 'bretessed',
  bretassy: 'bretessed', 'embattled-grady': 'embattled-grady', grady: 'grady', 'indented-grady': 'grady',
  wavy: 'wavy', undy: 'wavy', undee: 'wavy', 'wavy-crested': 'wavy-crested', nebuly: 'nebuly',
  indented: 'indented', dancetty: 'dancetty', engrailed: 'engrailed', invected: 'invected', invecked: 'invected',
  raguly: 'raguly', rayonny: 'rayonny', urdy: 'urdy', dovetailed: 'dovetailed', bevilled: 'bevilled',
  beviled: 'bevilled', bevelled: 'bevilled', angled: 'angled', enarched: 'enarched', arched: 'enarched',
  'double-arched': 'enarched', 'doubly-enarched': 'enarched', ploye: 'enarched', ployee: 'enarched',
  'flory-counterflory': 'flory-counterflory', 'counter-flory': 'flory-counterflory',
  counterflory: 'flory-counterflory', 'fleury-counterfleury': 'flory-counterflory',
  'counter-fleury': 'flory-counterflory', counterfleury: 'flory-counterflory', trefly: 'trefly',
  denticulada: 'denticulada', escartelly: 'escartelly',
};

/** Variegated patterns ("field treatments") → sub-tag: the variations by every spelling the widget reads (the sub-tag is the variation), and the rest. */
export const TREATMENTS: Record<string, string> = {
  ...VARIATION_SPELLINGS, barruly: 'barry', masoned: 'masoned',
  scaly: 'scaly', papelonny: 'papellony', papellony: 'papellony', plumetty: 'plumetty', plumety: 'plumetty',
  honeycombed: 'honeycombed', mailly: 'mailly', maily: 'mailly', mailed: 'mailly', fretty: 'fretty',
  grillage: 'fretty', compony: 'compony', gobony: 'compony', 'counter-compony': 'counter-compony',
  countercompony: 'counter-compony', pily: 'pily', masculy: 'masculy', diapered: 'diapered', marbled: 'marbled',
  tartan: 'tartan',
};

/** The names of a semy the widget words and reads: "semy-de-lys", "crusilly", "bezanty", "goutty" (de sang, d'or …) and their spellings. */
export const DRAWN_SEMY_NAMES: ReadonlySet<string> = new Set([...SEMY_NAMES.map((n) => n.word.split(' ')[0]), ...Object.keys(SEMY_SPELLINGS)].filter((x) => x !== 'semy'));

/** Strewn ("semy") forms: those the widget draws (a plain tincture strewn with a plain charge, on the field, a part of it or a band: gaps.ts `semyDrawn`) aren't gaps; the rest on the field → field-treatment:semy, on a picture or band → count:semy. */
export const SEMY_WORDS: readonly string[] = [
  ...DRAWN_SEMY_NAMES,
  ...w('semy seme semee torteauxy ogressy martletty martletted fleurety floretty roundelly decrescenty delfy aspersed powdered'),
];

/** Furs → sub-tag. "potent" and "potenty" are also a cross and a line; gaps.ts tells them apart. */
export const FURS: Record<string, string> = {
  ermine: 'ermine', ermines: 'ermines', erminois: 'erminois', pean: 'pean', 'counter-ermine': 'counter-ermine',
  counterermine: 'counter-ermine', vair: 'vair', 'counter-vair': 'counter-vair', countervair: 'counter-vair',
  vairy: 'vairy', 'counter-vairy': 'vairy', ermined: 'ermined', potent: 'potent', 'counter-potent': 'potent',
  counterpotent: 'potent', potenty: 'potent',
};

/** Tinctures the widget lacks → sub-tag. */
export const GAP_TINCTURES: Record<string, string> = {
  tenne: 'tenne', tawny: 'tenne', sanguine: 'sanguine', murrey: 'murrey', brunatre: 'brunatre',
  'bleu-celeste': 'bleu-celeste', celeste: 'bleu-celeste', cendree: 'cendree', tinctureless: 'tinctureless',
  copper: 'copper',
};

/** Words that are a division the widget lacks by themselves → sub-tag ("per …" is read in gaps.ts). */
export const GAP_DIVISION_WORDS: Record<string, string> = {
  gyronny: 'gyronny', tierced: 'tierced', chape: 'chape', chappe: 'chape', chausse: 'chausse', vetu: 'vetu',
  party: 'party-of-n',
};

// ── Postures, orientation, modifiers ────────────────────────────────────────

/** Posture words the widget has for some charges, with the widget posture they name. */
export const SUPPORTED_POSTURES: Record<string, string> = {
  rampant: 'rampant', segreant: 'rampant', passant: 'passant', trippant: 'passant', courant: 'courant',
  statant: 'statant', sejant: 'sejant', naiant: 'naiant', haurient: 'haurient', hauriant: 'haurient',
  displayed: 'displayed',
};

/** Postures and attitudes the widget never draws → sub-tag. */
export const GAP_POSTURES: Record<string, string> = Object.fromEntries([
  ...same(`guardant regardant combattant respectant addorsed couchant dormant salient rising volant close contourny
    affronty tergiant erect springing lodged clymant forcene embowed urinant uriant involved coiled glissant nowed
    migrant stooping striking perched trussing vorant ululant rousant jessant kneeling seated resting lying
    leaping rearing vigilant vulning sleeping hovering descending ondoyant ascending swimming diving
    climbing pascuant feeding crowing triumphant pouncing naissant herissony couched
    coward aversant counter-passant counter-rampant counter-statant counter-sejant counter-courant counter-salient
    counter-naiant counter-embowed counter-volant at-gaze in-pride in-piety in-vigilance in-benediction`),
  ['gardant', 'guardant'], ['reguardant', 'regardant'], ['combatant', 'combattant'], ['endorsed', 'addorsed'],
  ['contourne', 'contourny'], ['contournee', 'contourny'], ['contourney', 'contourny'], ['affronte', 'affronty'],
  ['affrontee', 'affronty'], ['counterpassant', 'counter-passant'], ['counterembowed', 'counter-embowed'],
  ['countersalient', 'counter-salient'], ['counterstatant', 'counter-statant'], ['saliant', 'salient'],
]);

/** A charge turned from its one fixed orientation → sub-tag. ("inverted" is a context word, see below.) */
export const ORIENTATIONS: Record<string, string> = {
  bendwise: 'bendwise', 'bendwise-sinister': 'bendwise-sinister', palewise: 'palewise', fesswise: 'fesswise',
  barwise: 'fesswise', saltirewise: 'saltirewise', chevronwise: 'chevronwise', pilewise: 'pilewise',
  crosswise: 'crosswise', lozengewise: 'lozengewise', bordurewise: 'bordurewise', pallwise: 'pallwise',
  reversed: 'reversed', widdershins: 'widdershins', clockwise: 'clockwise', 'to-sinister': 'to-sinister',
  'to-dexter': 'to-dexter', 'to-chief': 'to-chief', 'to-base': 'to-base', 'to-center': 'to-center',
};

/** Charge details the widget can't show → sub-tag. */
export const MODIFIERS: Record<string, string> = Object.fromEntries([
  ...same(`crowned collared gorged chained maintaining winged issuant erased conjoined interlaced enfiled transfixed
    pierced slipped leaved fructed seeded barbed armed langued attired unguled crined nimbed haloed enflamed bowed
    strung hilted pommelled embrued eradicated blasted tailed queue-fourchy demi jessant-de-lys torn eclipsed
    irradiated cabossed pendant sheathed hafted flighted fletched marked spotted veined banded garnished jeweled lit
    vested habited crested towered triple-towered two-towered sailing pennoned lined tasselled tied bound furled
    fracted broken horned unicornate bearded wingless legless headless tusked beaked membered footed finned plumed
    ringed belled jessed hooded muzzled bridled saddled caparisoned harnessed girt cloaked robed mounted riding
    breathing burning smoking enwrapped wrapped encircled surrounding enclosing environed distilling dripping
    weeping bleeding sprouting flowered fructed budded stalked stemmed rooted trunked dismembered severed nocked
    drawn unstrung stringless unsheathed quilloned cup-hilted swept-hilt double-bitted single-bitted double-bladed
    wavy-bladed crossed edged bordered pearled gemmed forked doubled tufted barded studded nailed windowed roofed
    capped open-mouthed clawed taloned plenitude tipped ensigned suspended dependent depending attached
    accompanied flanked reflexed disjointed spiked armoured helmed shod booted gloved cuffed brandishing elevated
    lowered extended outstretched upraised raised encircling orbed clenched wreathed covered wearing striped
    flanged sailed swallowtailed terminating chased gauntleted ragged hexagonal foaming maned fouled en-soleil
    beset irised bellied chainless shedding apaumy clouded cracked framed looped unfurled mastless feathered
    leathered ruined thorned skeletal sundered garbed ribboned sufflexed snagged portalled sailless loaded
    elongated rayonnant`),
  ['ducally', 'crowned'], ['issuing', 'issuant'], ['imbrued', 'embrued'], ['pommeled', 'pommelled'],
  ['jewelled', 'jeweled'], ['tasseled', 'tasselled'], ['queue-forchy', 'queue-fourchy'],
  ['queue-forchee', 'queue-fourchy'], ['queue-fourchee', 'queue-fourchy'], ['queued', 'queue-fourchy'],
  ['double-queued', 'queue-fourchy'], ['caboshed', 'cabossed'], ['holding', 'maintaining'],
  ['grasping', 'maintaining'], ['sustaining', 'maintaining'], ['supporting', 'maintaining'],
  ['bearing', 'maintaining'], ['clasping', 'maintaining'], ['clutching', 'maintaining'], ['carrying', 'maintaining'],
  ['wielding', 'maintaining'], ['maintained', 'maintaining'], ['sustained', 'maintaining'],
  ['supported', 'maintaining'], ['held', 'maintaining'], ['two-headed', 'multi-headed'],
  ['double-headed', 'multi-headed'], ['three-headed', 'multi-headed'], ['seven-headed', 'multi-headed'],
  ['five-headed', 'multi-headed'], ['triple-headed', 'multi-headed'], ['tricorporate', 'multi-bodied'],
  ['bicorporate', 'multi-bodied'], ['interlinked', 'conjoined'], ['interlocking', 'conjoined'],
  ['joined', 'conjoined'], ['linked', 'conjoined'], ['entwined', 'interlaced'], ['intertwined', 'interlaced'],
  ['braced', 'interlaced'], ['inflamed', 'enflamed'], ['flaming', 'enflamed'], ['flammant', 'enflamed'],
  ['fired', 'enflamed'], ['flamed', 'enflamed'], ['lighted', 'lit'], ['vomiting', 'breathing'],
  ['incensed', 'breathing'], ['leafed', 'leaved'], ['foliated', 'leaved'], ['flowering', 'flowered'],
  ['fruited', 'fructed'], ['transfixing', 'transfixed'], ['piercing', 'transfixed'], ['enfiling', 'enfiled'],
  ['armored', 'armoured'], ['knotted', 'nowed'], ['appaumy', 'apaumy'], ['complement', 'plenitude'],
  ['plentitude', 'plenitude'], ['half', 'demi'],
]);

/**
 * Words whose category depends on what they follow: after a division a division variant ("per
 * chevron inverted"), after an ordinary an ordinary-treatment ("a chevron couped"), after a charge a
 * charge-modifier or orientation ("a sword inverted").
 */
export const CONTEXT_WORDS = w(`
  couped humetty inverted fimbriated fimbriate voided cotised cotissed enhanced abased throughout rompu fracted
  nowy pointed triangular double fitchy fitched issuant conjoined pierced quarter-pierced interlaced embowed
  parted fretted offset shortened flory fleury formy bottony botonny bottonny clechy pommetty fourchy quadrate
  pointe moline patonce arrondi arrondy
`);

/** Cross variants after "cross" ("a cross formy") → sub-tag via gaps.ts' CROSS_VARIANT spellings. */
export const CROSS_POST = w(`
  formy formee pattee patty paty patee patonce patoncy flory fleury moline bottony botonny botony clechy
  cleche clechee potent avellane fitchy fitched pommelly pommetty pomelly pommy quadrate fourchy ancree anchored
  anchory recercelly couped humetty nowy voided gringolee gringole degraded double-parted fleuretty barby
  crescented annuletty ringed pierced ansata stellata gurgity anille alisee
`);
/** Cross variants before "cross" ("a Maltese cross"). */
export const CROSS_PRE = w(`
  latin celtic maltese jerusalem bowen calatrava patriarchal russian orthodox greek coptic canterbury toulouse
  santiago papal tau armenian lorraine passion calvary iona saint brigid templar teutonic swedish norse
  irish byzantine equal-armed
`);

/** Places on the shield after "in" ("in chief", "in dexter base"). */
export const POSITION_WORDS = w('chief base canton flank point fess-point dexter sinister center centre middle');

/** Arrangement words after "in" the widget has no arrangement for → sub-tag. */
export const GAP_ARRANGEMENTS: Record<string, string> = {
  chevron: 'in-chevron', pall: 'in-pall', pile: 'in-pile', bordure: 'in-orle',
  circle: 'in-annulo', ring: 'in-annulo', triangle: 'in-triangle', estoile: 'in-estoile', star: 'in-estoile',
  mascle: 'in-mascle', lozenge: 'in-lozenge', square: 'in-square', arch: 'in-arch', triquetra: 'in-triquetra',
};

/** Arrangement words after "in" the widget does have → its Arrangement id (legality depends on the count). */
export const SUPPORTED_ARRANGEMENT_WORDS: Record<string, string> = {
  pale: 'in-pale', fess: 'in-fess', bend: 'in-bend', 'bend-sinister': 'in-bend-sinister', cross: 'in-cross', saltire: 'in-saltire',
  orle: 'in-orle', annulo: 'in-annulo', chief: 'in-chief', base: 'in-base',
};

/** Marshalling and augmentation words → sub-tag. */
export const MARSHALLING: Record<string, string> = {
  impaling: 'impaling', impaled: 'impaling', dimidiating: 'dimidiating', dimidiated: 'dimidiating',
  quartered: 'quartering', quartering: 'quartering', augmentation: 'augmentation', pretence: 'pretence',
  pretense: 'pretence', surtout: 'pretence', achievement: 'arms-of', arms: 'arms-of',
};

/** Number words; counts above six are a count gap. */
export const NUMBERS: Record<string, number> = {
  a: 1, an: 1, one: 1, single: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, many: 99, several: 99,
  ...Object.fromEntries(Array.from({ length: 30 }, (_, n) => [String(n + 1), n + 1])), // "2, 2, and 1"
};

// ── Words with no gap of their own ──────────────────────────────────────────

/** Function words. */
export const FUNCTION_WORDS = w(`
  the and of with its his her their them it itself themselves all each both own another other others to from by
  at as upon on in between within over under above below beneath into about around through atop surmounted
  debruised debruising overall charged that this those these which who whose is are be being also same like
  first second third fourth fifth sixth last field tincture tinctures colour color metal for sometimes either any
  whole entire part line division partition lines edge edges side sides end ends top bottom upper lower middle
  outer inner left right central centre center hind fore front back near far open natural domestic heraldic
  common great greater lesser small large little big long short tall young full plain simple together
  alternately alternating respectively thereon therefrom therein thereof wholly among amid amidst against across
  along toward towards out up down off away before behind beside besides beyond facing faced forming formed
  making made composed comprised consisting containing contained but not no nor so then than very more most less
  least much some such what when where while sur en de du des la le les et
`);

/**
 * Qualifiers: colour words of "natural" descriptions ("a brown bear proper"), national, material and
 * style adjectives, and parts named only to describe a charge ("its tail nowed", "wings elevated").
 * A part after a possessive still makes a compound charge ("a lion's tail").
 */
export const QUALIFIER_WORDS = w(`
  brown white black red blue green grey gray golden silver yellow pink russet ginger tabby human wooden profile
  outward outwards inward inwards straight round flat broad ancient antique empty wild polar brunette blonde male
  female diverse various arabic arabian asian east eastern western roman greek grecian norse irish scottish
  japanese chinese egyptian african caucasian ukrainian cornish continental bengal russian german english french
  danish norman saxon gothic lombardic uncial hebrew persian ionic county ducal comedy tragedy theatrical dunghill
  capital lowercase uppercase blackletter script wine cooking kitchen drawing knitting tilting bottlenosed paschal
  praying world new old wards tips tip form iron wood leather cloth thread string cord lace oil frame handle link
  span phrase spread bladed opening ending shipped triply headed splendor splendour lochaber ansteorra equal
  sinister dexter points rays stringed handled tail beak forepaw neck talon claw breast shoulder body foreleg
  hindleg hindquarter forequarter foreparts wrist forehead wingtip flank mane tongue hilt haft blade pommel
  quillon scabbard grasped tine european legged paned snow snowy conical triple tripartite apothecary domed
  effluent eyed forefoot frying haunch hip thigh toe waist knee lobed scale spined spired steeled concave glory
  hinge jack loop petal piece replaced corner angle foreclaw jaw singly turned sole spoke hub crest rest
  pupilled billed shelled sperm julian michael monarch swift falco bald clay ink trait trailing mash buckled
  glassed larmes leonine madder rosa vigilance modesty paint panache arctos ursus vulpes felis leo panthera
  quercus bactrian combed curled detailed drawstring emperor french-cut guinea honor index india inscribed length
  loincloth mark missing naked nesting representing rolled rear slow spouted spout throated twined union vented
  vulgaris wattled chasing chiefmost connected corded counter delineated dependant embedded fastened flexed
  folded granite hammered jelloped mantled musical odorata poison portative range recurved riven shackled strap
  trimmed tuft tusk orly page clump chimalli
`);
