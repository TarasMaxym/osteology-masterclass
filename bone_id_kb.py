#!/usr/bin/env python3
"""
Bone ID & Siding Knowledge Base for JUMC Anatomy Test 1:
- Practice at-a-glance naming the bone period (not just its landmark pins)
- Dedicated Left vs Right Specimen Trainer with comprehensive 3-Point Orientation Rules
- Limb bones from different angles & tricky confusions (Radius vs Ulna, Tibia vs Fibula, Humerus vs Femur, Clavicle vs Rib)
- Vertebrae Showdown: C1 Atlas vs C2 Axis vs Typical Cervical vs Thoracic vs Lumbar vs Sacrum
- Carpals & Hand Bones: Scaphoid, Lunate, Triquetrum, Pisiform, Trapezium, Trapezoid, Capitate, Hamate
- Tarsals & Foot Bones: Talus, Calcaneus, Navicular, Cuboid, Medial/Intermediate/Lateral Cuneiforms
- Cranial & Facial Bones: Frontal, Parietal, Occipital, Sphenoid, Temporal, Ethmoid, Maxilla, Mandible, Zygomatic, Palatine, Hyoid
"""

BONE_ID_CATEGORIES = [
    {"id": "ALL", "label": "All Bones & Specimens", "icon": "🦴", "desc": "Mixed rapid-fire recognition across all specimens"},
    {"id": "SIDING", "label": "Left vs. Right Trainer", "icon": "↔️", "desc": "Determine whether specimen is LEFT or RIGHT with 3-point rules"},
    {"id": "LIMBS", "label": "Limb Bones & Confusions", "icon": "🦵", "desc": "Radius vs Ulna, Tibia vs Fibula, Humerus vs Femur, Clavicle vs Rib"},
    {"id": "VERTEBRAE", "label": "Vertebrae Showdown", "icon": "🧱", "desc": "Atlas C1, Axis C2, Typical Cervical, Thoracic, Lumbar, Sacrum"},
    {"id": "CARPALS", "label": "Carpals & Hand Bones", "icon": "✋", "desc": "All 8 individual carpals, metacarpals & hand skeleton"},
    {"id": "TARSALS", "label": "Tarsals & Foot Bones", "icon": "🦶", "desc": "Talus, Calcaneus, Navicular, Cuboid, 3 Cuneiforms & foot skeleton"},
    {"id": "SKULL", "label": "Cranial & Facial Bones", "icon": "💀", "desc": "Frontal, Parietal, Occipital, Sphenoid, Temporal, Ethmoid, Mandible, etc."},
]

# Helper to build consistent item structures
def make_siding_item(item_id, bone, view, side, image, slide_id, cue, sup_inf, ant_post, med_lat, trap=""):
    return {
        "id": item_id,
        "categories": ["SIDING", "LIMBS"],
        "mode": "siding",
        "prompt": f"Is this {bone} specimen LEFT or RIGHT?",
        "bone": bone,
        "view": view,
        "side": side,
        "image": image,
        "slideId": slide_id,
        "answer": side,
        "choices": ["Left", "Right"],
        "synonyms": [side.lower(), f"{side.lower()} {bone.lower()}", f"{side.lower()} side"],
        "cue": cue,
        "sidingRule": {
            "superiorInferior": sup_inf,
            "anteriorPosterior": ant_post,
            "medialLateral": med_lat,
            "summary": f"{sup_inf} {ant_post} {med_lat} → Confirms {side.upper()} {bone.upper()}.",
        },
        "trap": trap,
    }


def make_id_item(item_id, categories, prompt, bone, view, answer, choices, image, slide_id, cue, trap="", synonyms=None, side=""):
    if synonyms is None:
        synonyms = [answer.lower()]
    return {
        "id": item_id,
        "categories": categories,
        "mode": "identify",
        "prompt": prompt,
        "bone": bone,
        "view": view,
        "side": side,
        "image": image,
        "slideId": slide_id,
        "answer": answer,
        "choices": choices,
        "synonyms": synonyms,
        "cue": cue,
        "trap": trap,
    }


# =====================================================================
# 1. SIDING TRAINER (LEFT VS. RIGHT SPECIMENS WITH 3-POINT RULES)
# =====================================================================
SIDING_ITEMS = [
    # --- SCAPULA ---
    make_siding_item(
        "side_scapula_ant",
        "Scapula",
        "Costal / Anterior Surface",
        "Left",
        "media/bones/image32.jpeg?v2",
        "bones_27",
        "Costal surface faces us (smooth subscapular fossa). Glenoid cavity and coracoid process face laterally (viewer's right).",
        "Superior margin & suprascapular notch are superior; sharp inferior angle points downward.",
        "Smooth concave subscapular fossa is anterior (faces ribs); dorsal spine is posterior.",
        "Glenoid cavity and acromion face laterally (viewer's right); long straight medial border faces the vertebral column (viewer's left).",
        "In anterior (costal) view: medial border is towards midline (viewer's left), and lateral glenoid cavity points towards the left shoulder (viewer's right) → Confirms LEFT SCAPULA."
    ),
    make_siding_item(
        "side_scapula_post",
        "Scapula",
        "Dorsal / Posterior Surface",
        "Left",
        "media/bones/image35.jpeg?v2",
        "bones_28",
        "Dorsal surface faces us (prominent scapular spine visible). Acromion and glenoid are on the lateral side (viewer's left).",
        "Supraspinatus fossa is superior; infraspinatus fossa is inferior; inferior angle points downward.",
        "Spine of scapula is posterior (faces camera); costal surface is anterior.",
        "Glenoid cavity and acromion are lateral (viewer's left); trigone of spine and medial border are medial (viewer's right).",
        "In posterior (dorsal) view, looking at the back from behind: the lateral glenoid/acromion is on viewer's left (towards left arm), while medial vertebral margin is towards midline (viewer's right) → Confirms LEFT SCAPULA."
    ),

    # --- CLAVICLE ---
    make_siding_item(
        "side_clavicle_sup",
        "Clavicle",
        "Superior Surface",
        "Left",
        "media/bones/image24.jpeg?v2",
        "bones_23",
        "Superior surface is smooth. Sternal end is bulbous on left; acromial end is flat on right; medial 2/3 curves convex forward.",
        "Superior surface is smooth; inferior surface has conoid tubercle, trapezoid line & subclavian groove.",
        "Medial two-thirds is CONVEX anteriorly; lateral one-third is CONCAVE anteriorly.",
        "Sternal end is quadrilateral and rounded (medial); acromial end is flattened (lateral).",
        "Sternal end medial (left), acromial end lateral (right), convex forward in medial 2/3 → LEFT CLAVICLE."
    ),
    make_siding_item(
        "side_clavicle_inf",
        "Clavicle",
        "Inferior Surface",
        "Left",
        "media/bones/image26.jpeg?v2",
        "bones_24",
        "Inferior surface is rough with conoid tubercle, trapezoid line, and sulcus for subclavius.",
        "Inferior surface faces us (features conoid tubercle and subclavian groove).",
        "Conoid tubercle is POSTERIOR and inferior.",
        "Sternal end (medial) is on the right; acromial end with trapezoid line (lateral) is on the left.",
        "In inferior view, the posterio-inferior conoid tubercle sits along posterior border → LEFT CLAVICLE."
    ),

    # --- HUMERUS ---
    make_siding_item(
        "side_humerus_whole",
        "Humerus",
        "Anterior View (Full Bone)",
        "Left",
        "media/bones/image40.jpeg?v2",
        "bones_31",
        "Head is proximal and faces medially; bicipital groove faces anteriorly; capitulum is lateral.",
        "Rounded head is proximal; trochlea and capitulum are distal.",
        "Intertubercular (bicipital) groove is anterior; deep olecranon fossa is posterior.",
        "Articular head faces medially; larger medial epicondyle is medial.",
        "Head medial, bicipital groove anterior → LEFT HUMERUS."
    ),
    make_siding_item(
        "side_humerus_prox",
        "Humerus",
        "Proximal End (Anterior View)",
        "Left",
        "media/bones/image44.jpeg?v2",
        "bones_33",
        "Head faces medially (viewer's left); lesser tubercle is anterior; greater tubercle is lateral (viewer's right).",
        "Head is proximal/superior; surgical neck is inferior.",
        "Lesser tubercle and intertubercular groove face anteriorly.",
        "Articular head faces medially; greater tubercle sits laterally.",
        "Head medial, lesser tubercle anterior → LEFT HUMERUS."
    ),
    make_siding_item(
        "side_humerus_dist_ant",
        "Humerus",
        "Distal End (Anterior View)",
        "Left",
        "media/bones/image46.jpeg?v2",
        "bones_34",
        "Medial epicondyle is on viewer's left; capitulum and lateral epicondyle on viewer's right; coronoid fossa anterior.",
        "Shaft is proximal; articular condyles are distal.",
        "Coronoid and radial fossae are anterior; deep olecranon fossa is posterior.",
        "Medial epicondyle is large and medial; rounded capitulum is lateral.",
        "Anterior view with medial epicondyle on left and capitulum on right → LEFT HUMERUS."
    ),
    make_siding_item(
        "side_humerus_dist_post",
        "Humerus",
        "Distal End (Posterior View)",
        "Left",
        "media/bones/image47.jpeg?v2",
        "bones_35",
        "Deep olecranon fossa is posterior; ulnar nerve sulcus runs behind medial epicondyle on viewer's right.",
        "Shaft is proximal; olecranon fossa is distal.",
        "Deep triangular olecranon fossa is POSTERIOR.",
        "Ulnar nerve sulcus grooves posterior surface of MEDIAL epicondyle (viewer's right in posterior view).",
        "Posterior view with medial epicondyle on viewer's right → LEFT HUMERUS."
    ),

    # --- RADIUS ---
    make_siding_item(
        "side_radius_whole",
        "Radius",
        "Anterior View (Full Bone)",
        "Left",
        "media/bones/image49.jpeg?v2",
        "bones_36",
        "Disc-like head is proximal; radial tuberosity points medially; pointed styloid process is lateral.",
        "Circular head is proximal; expanded distal end with styloid process is distal.",
        "Anterior surface of distal shaft is smooth and flat; posterior surface has Lister's dorsal tubercle.",
        "Radial styloid process is LATERAL; ulnar notch and radial tuberosity are MEDIAL.",
        "Head proximal, styloid lateral, ulnar notch medial → LEFT RADIUS."
    ),
    make_siding_item(
        "side_radius_dist_ant",
        "Radius",
        "Distal End (Anterior View)",
        "Left",
        "media/bones/image54.jpeg?v2",
        "bones_39",
        "Smooth flat anterior surface; pointed styloid process on viewer's right (lateral); concave ulnar notch on viewer's left (medial).",
        "Shaft is proximal; carpal articular facet is distal.",
        "Flat, smooth distal anterior surface; extensor tendon grooves are posterior.",
        "Styloid process is LATERAL (viewer's right); concave ulnar notch is MEDIAL (viewer's left).",
        "Anterior surface facing us with styloid lateral (right) → LEFT RADIUS."
    ),
    make_siding_item(
        "side_radius_dist_post",
        "Radius",
        "Distal End (Posterior View)",
        "Left",
        "media/bones/image56.jpeg?v2",
        "bones_41",
        "Prominent dorsal (Lister's) tubercle is posterior; grooved for extensor pollicis longus tendon.",
        "Shaft is proximal; carpal articular margin is distal.",
        "Dorsal tubercle (Lister's tubercle) is distinctly POSTERIOR.",
        "Styloid process is LATERAL; ulnar notch is MEDIAL.",
        "Posterior view with dorsal tubercle facing us → LEFT RADIUS."
    ),

    # --- ULNA ---
    make_siding_item(
        "side_ulna_whole",
        "Ulna",
        "Anterior View (Full Bone)",
        "Left",
        "media/bones/image57.jpeg?v2",
        "bones_42",
        "Massive wrench-like proximal end; small head distally; sharp interosseous crest points laterally towards radius.",
        "Olecranon and trochlear notch are proximal; small head and styloid process are distal.",
        "Deep C-shaped trochlear notch faces ANTERIORLY.",
        "Radial notch and sharp interosseous border are LATERAL; ulnar tuberosity is anterior/medial.",
        "Trochlear notch anterior, radial notch lateral → LEFT ULNA."
    ),
    make_siding_item(
        "side_ulna_prox",
        "Ulna",
        "Proximal End (Anterolateral View)",
        "Left",
        "media/bones/image61.jpeg?v2",
        "bones_45",
        "Trochlear notch faces anteriorly; radial notch (shallow circular facet) is lateral on viewer's right.",
        "Olecranon is proximal; shaft continues inferiorly.",
        "C-shaped trochlear notch faces anteriorly.",
        "Radial notch for head of radius sits on LATERAL side of coronoid process.",
        "Trochlear notch anterior, radial notch on lateral side → LEFT ULNA."
    ),

    # --- HIP BONE (OS COXAE) ---
    make_siding_item(
        "side_hip_medial",
        "Hip Bone",
        "Internal / Medial View",
        "Left",
        "media/bones/image64.jpeg?v2",
        "bones_47",
        "Iliac crest superior; rough auricular surface & iliac tuberosity are posterior (left); smooth pubis is anterior (right).",
        "Fan-shaped iliac blade is superior; obturator foramen & ischial tuberosity are inferior.",
        "Pubis and pubic tubercle are ANTERIOR (viewer's right); greater sciatic notch and auricular surface are POSTERIOR (viewer's left).",
        "Auricular surface and smooth internal iliac fossa face MEDIALLY; acetabulum faces laterally.",
        "Internal (medial) view: facing the pelvic cavity with iliac blade superior, anterior pubis is on viewer's right and posterior sacral auricular surface is on viewer's left → Confirms LEFT HIP BONE."
    ),
    make_siding_item(
        "side_hip_lateral",
        "Hip Bone",
        "Lateral / Acetabular View",
        "Left",
        "media/bones/image65.jpeg?v2",
        "bones_48",
        "Cup-like acetabulum faces laterally; ASIS & AIIS on viewer's left (anterior); ischial tuberosity on viewer's right (posterior).",
        "Iliac crest is superior; ischial tuberosity and obturator foramen are inferior.",
        "ASIS and AIIS are ANTERIOR (viewer's left); PSIS, PIIS, and ischial tuberosity are POSTERIOR (viewer's right).",
        "Acetabulum faces LATERALLY.",
        "Lateral (acetabular) view: looking at the left hip from the outside with iliac crest up, anterior spines are on viewer's left and posterior ischium is on viewer's right → Confirms LEFT HIP BONE."
    ),

    # --- FEMUR ---
    make_siding_item(
        "side_femur_prox_ant",
        "Femur",
        "Proximal End (Anterior View)",
        "Right",
        "media/bones/image72.jpeg?v2",
        "bones_54",
        "Head with fovea capitis projects medially (viewer's right); greater trochanter is lateral (viewer's left); intertrochanteric line is anterior.",
        "Hemispherical head and neck are proximal/superior; shaft extends inferiorly.",
        "Smooth shaft with flat intertrochanteric line is ANTERIOR; rough trochanteric crest is posterior.",
        "Articular head projects MEDIALLY; greater trochanter sits LATERALLY.",
        "Anterior view with head pointing medially (right) and trochanter lateral (left) → RIGHT FEMUR."
    ),
    make_siding_item(
        "side_femur_dist_post",
        "Femur",
        "Distal End (Posterior View)",
        "Right",
        "media/bones/image78.jpeg?v2",
        "bones_58",
        "Posterior view: deep intercondylar fossa faces us; prominent adductor tubercle sits on medial epicondyle (viewer's left).",
        "Shaft is proximal; condyles sit horizontally on tibial plateau.",
        "Deep intercondylar fossa and flat popliteal surface are POSTERIOR; smooth patellar surface is anterior.",
        "Medial condyle extends further back and carries adductor tubercle (viewer's left); lateral condyle has popliteal groove (viewer's right).",
        "Posterior view: with popliteal surface facing us, medial condyle/adductor tubercle is on viewer's left (towards midline) and lateral epicondyle is on viewer's right → Confirms RIGHT FEMUR."
    ),

    # --- TIBIA ---
    make_siding_item(
        "side_tibia_plateau",
        "Tibia",
        "Superior Tibial Plateau (Top-Down View)",
        "Right",
        "media/bones/image84.jpeg?v2",
        "bones_63",
        "Tibial tuberosity points anteriorly (up); medial condyle on viewer's left; lateral condyle (fibular facet) on viewer's right.",
        "Plateau is proximal/superior; shaft extends downward.",
        "Rough tibial tuberosity is ANTERIOR; posterior intercondylar area is posterior.",
        "Medial condyle is larger and oval on viewer's left (medial); lateral condyle is circular and has fibular facet on viewer's right (lateral).",
        "Superior view of tibial plateau: with tibial tuberosity anterior (up), medial condyle is on viewer's left (towards midline) and lateral condyle is on viewer's right (towards fibula) → Confirms RIGHT TIBIA."
    ),
    make_siding_item(
        "side_tibia_dist",
        "Tibia",
        "Distal End (Inferior/Anterior View)",
        "Right",
        "media/bones/image87.jpeg?v2",
        "bones_65",
        "Medial malleolus extends downward on the medial side (viewer's right); fibular notch sits laterally on opposite side (viewer's left).",
        "Shaft is proximal; quadrilateral inferior articular facet is distal.",
        "Anterior margin is smooth; posterior margin is grooved for tibialis posterior and FDL tendons.",
        "Medial malleolus is MEDIAL (viewer's right in anterior view); concave fibular notch is LATERAL (viewer's left in anterior view).",
        "Anterior view of distal tibia: looking from the front, medial malleolus is on viewer's right (towards midline) and fibular notch is on viewer's left → Confirms RIGHT TIBIA."
    ),

    # --- FIBULA ---
    make_siding_item(
        "side_fibula_malleolus",
        "Fibula",
        "Distal End (Lateral Malleolus)",
        "Left",
        "media/bones/image90.jpeg?v2",
        "bones_68",
        "Lateral malleolus distal; smooth triangular facet faces medially (towards talus); malleolar fossa is posterior.",
        "Head with pointed apex is proximal; lateral malleolus is distal.",
        "Deep triangular malleolar fossa is POSTERIOR to the articular facet.",
        "Smooth triangular articular facet faces MEDIALLY towards talus.",
        "Articular facet medial, malleolar fossa posterior → LEFT FIBULA."
    ),

    # --- CALCANEUS ---
    make_siding_item(
        "side_calcaneus_sup",
        "Calcaneus",
        "Superior / Medial View",
        "Right",
        "media/bones/image94.jpeg?v2",
        "bones_71",
        "Calcaneal tuber is posterior (heel); sustentaculum tali projects medially as a horizontal shelf.",
        "Talar articular facets are superior; rough calcaneal tuber touches the ground inferiorly.",
        "Calcaneal tuber is POSTERIOR; cuboid articular facet is ANTERIOR.",
        "Shelf-like sustentaculum tali projects MEDIALLY; peroneal trochlea is on lateral surface.",
        "Posterior tuber on right, medial shelf (sustentaculum tali) on bottom/medial side → RIGHT CALCANEUS."
    ),

    # --- TALUS ---
    make_siding_item(
        "side_talus_sup",
        "Talus",
        "Superior View (Trochlea & Head)",
        "Left",
        "media/bones/image100.jpeg?v2",
        "bones_77",
        "Rounded head faces anteriorly; convex trochlea superior; large triangular articular surface is on lateral side.",
        "Convex pulley-like trochlea is superior; concave calcaneal facets are inferior.",
        "Rounded head faces ANTERIORLY; posterior process with FHL groove is POSTERIOR.",
        "Large triangular facet is LATERAL (fibula); small comma-shaped facet is MEDIAL (tibia).",
        "Head anterior, large triangular facet lateral (viewer's right) → LEFT TALUS."
    ),

    # --- TYPICAL RIB ---
    make_siding_item(
        "side_rib_typical",
        "Typical Rib",
        "Internal / Posterior View",
        "Right",
        "media/bones/image1.jpeg?v2",
        "bones_01",
        "Head with articular facets is posterior; costal groove runs along the sharp inferior internal margin.",
        "Superior border is thick and rounded; inferior border is sharp and contains the costal groove.",
        "Head and tubercle are POSTERIOR (vertebral end); concave cup is ANTERIOR (sternal end).",
        "Internal concave surface faces medially toward the lung; external surface is convex.",
        "Head posterior, costal groove inferior & internal → RIGHT RIB."
    ),

    # --- 1ST RIB ---
    make_siding_item(
        "side_rib_1st",
        "1st Rib",
        "Superior Surface",
        "Right",
        "media/bones/image5.jpeg?v2",
        "bones_04",
        "Scalene tubercle is on inner border of superior surface; groove for subclavian vein is anterior to it, subclavian artery posterior.",
        "Superior surface is grooved and marked by scalene tubercle; inferior surface is smooth with no costal groove.",
        "Sternal end is ANTERIOR; head and neck are POSTERIOR.",
        "Concave sharp margin is MEDIAL (internal); convex margin is LATERAL (external).",
        "Head posterior, scalene tubercle on inner medial border, anterior groove for subclavian vein → RIGHT 1ST RIB."
    ),

    # --- TEMPORAL BONE ---
    make_siding_item(
        "side_temporal_lateral",
        "Temporal Bone",
        "Lateral / Squamous View",
        "Left",
        "media/skull/image4.jpeg?v2",
        "skull_02",
        "Lateral view of skull: face/orbit is on viewer's left (anterior), occiput on viewer's right (posterior). Zygomatic process points anteriorly, mastoid process posterior/inferior.",
        "Flat thin squamous part is superior; conical mastoid process points inferiorly.",
        "Zygomatic process projects ANTERIORLY (viewer's left); mastoid process is POSTERIOR (viewer's right).",
        "External acoustic meatus (EAM) and squamous surface face LATERALLY (facing camera).",
        "Lateral view of the cranium: with face on viewer's left (anterior) and occiput on viewer's right (posterior), this lateral aspect faces the LEFT side of the head → Confirms LEFT TEMPORAL BONE."
    ),

    # --- ZYGOMATIC BONE ---
    make_siding_item(
        "side_zygomatic",
        "Zygomatic Bone",
        "Anterolateral View",
        "Left",
        "media/skull/image4.jpeg?v2",
        "skull_16",
        "Lateral view of skull: face/orbit is on viewer's left (anterior), occiput on viewer's right (posterior). Frontal process points superiorly; temporal process extends posteriorly.",
        "Pointed frontal process is SUPERIOR; maxilla-facing border is inferior and medial.",
        "Smooth malar surface is ANTEROLATERAL; temporal process points POSTERIORLY (toward viewer's right).",
        "Orbital surface is anteromedial; lateral malar surface faces viewer.",
        "Lateral view of skull: the face points to viewer's left (anterior) and occiput to viewer's right (posterior). You are viewing the LEFT cheek and zygomatic arch → Confirms LEFT ZYGOMATIC BONE."
    ),

    # --- MAXILLA ---
    make_siding_item(
        "side_maxilla",
        "Maxilla",
        "Anterior / Facial Surface",
        "Right",
        "media/skull/image1.jpeg?v2",
        "skull_15",
        "Anterior facial view: note the pinned right maxilla (pins #2-5 on viewer's left: frontal process, zygomatic process, zygomaticoalveolar crest): frontal process points superiorly, teeth inferior, nasal notch medial.",
        "Frontal process is SUPERIOR; dental alveolar ridge is INFERIOR.",
        "Facial surface with canine fossa & infraorbital foramen faces ANTERIORLY; infratemporal surface faces posteriorly.",
        "Nasal notch & piriform aperture border are MEDIAL (viewer's right for this right-side bone); zygomatic process is LATERAL (viewer's left).",
        "Anterior view: with frontal process superior and teeth inferior, the patient's right maxilla sits on viewer's left (nasal notch medial, zygomatic process lateral) → Confirms RIGHT MAXILLA."
    ),
]


# =====================================================================
# 2. VERTEBRAE SHOWDOWN (TYPES & SPECIFIC VERTEBRAE DISCRIMINATION)
# =====================================================================
VERTEBRAE_ITEMS = [
    make_id_item(
        "vert_atlas_sup",
        ["VERTEBRAE", "ALL"],
        "Identify this specific vertebra at a glance:",
        "Atlas (C1)",
        "Superior View",
        "Atlas (C1)",
        ["Atlas (C1)", "Axis (C2)", "Typical Cervical (C3–C6)", "Thoracic Vertebra"],
        "media/bones/image14.jpeg?v2",
        "bones_13",
        "Ring-shaped vertebra with NO body and NO spinous process. Features large concave kidney-shaped superior articular facets for occipital condyles (atlanto-occipital 'yes' joint).",
        "Don't confuse with Axis (C2): Atlas has NO dens and NO body at all!",
        synonyms=["atlas", "c1", "atlas c1", "first cervical vertebra", "1st cervical vertebra"]
    ),
    make_id_item(
        "vert_axis_sup",
        ["VERTEBRAE", "ALL"],
        "Identify this specific vertebra at a glance:",
        "Axis (C2)",
        "Posterosuperior View",
        "Axis (C2)",
        ["Axis (C2)", "Atlas (C1)", "C7 (Vertebra prominens)", "Lumbar Vertebra"],
        "media/bones/image17.jpeg?v2",
        "bones_16",
        "Pathognomonic upward-projecting tooth-like DENS (odontoid process) on the body. Large broad bifid spinous process. Serves as pivot for C1 rotation (atlanto-axial 'no' joint).",
        "Dens instantly distinguishes C2 from every other vertebra in the human body.",
        synonyms=["axis", "c2", "axis c2", "second cervical vertebra", "2nd cervical vertebra"]
    ),
    make_id_item(
        "vert_cervical_typical",
        ["VERTEBRAE", "ALL"],
        "Identify this vertebra type at a glance:",
        "Cervical Vertebra (Typical C3–C6)",
        "Superior View",
        "Typical Cervical Vertebra",
        ["Typical Cervical Vertebra", "Thoracic Vertebra", "Lumbar Vertebra", "Atlas (C1)"],
        "media/bones/image12.jpeg?v2",
        "bones_11",
        "PATHOGNOMONIC TRANSVERSE FORAMINA in transverse processes (for vertebral artery). Triangular vertebral canal, small rectangular body with elevated lateral UNCI, and BIFID spinous process.",
        "Transverse foramina are present ONLY in cervical vertebrae! If you see foramina in transverse processes, it is 100% CERVICAL.",
        synonyms=["typical cervical vertebra", "cervical vertebra", "cervical", "typical cervical"]
    ),
    make_id_item(
        "vert_thoracic",
        ["VERTEBRAE", "ALL"],
        "Identify this vertebra type at a glance:",
        "Thoracic Vertebra",
        "Superior / Lateral View",
        "Thoracic Vertebra",
        ["Thoracic Vertebra", "Lumbar Vertebra", "Cervical Vertebra", "Axis (C2)"],
        "media/bones/image20.jpeg?v2",
        "bones_19",
        "HEART-SHAPED vertebral body, circular vertebral foramen. Long slender spinous process sloping steeply downward. COSTAL FACETS on sides of body (for rib heads) and transverse processes (for rib tubercles).",
        "Costal facets are unique to thoracic vertebrae! Lumbar vertebrae have NO costal facets.",
        synonyms=["thoracic vertebra", "thoracic", "typical thoracic vertebra"]
    ),
    make_id_item(
        "vert_lumbar_sup",
        ["VERTEBRAE", "ALL"],
        "Identify this vertebra type at a glance:",
        "Lumbar Vertebra",
        "Superior View",
        "Lumbar Vertebra",
        ["Lumbar Vertebra", "Thoracic Vertebra", "Cervical Vertebra", "Sacrum"],
        "media/bones/image21.jpeg?v2",
        "bones_20",
        "MASSIVE KIDNEY-SHAPED vertebral body (carries maximum axial weight). Triangular vertebral canal, short sturdy rectangular spinous process. Features MAMMILLARY PROCESSES on superior articular processes and ACCESSORY PROCESSES at base of transverse processes.",
        "NO transverse foramina (not cervical) and NO costal facets (not thoracic). Mammillary processes are unique to lumbar vertebrae.",
        synonyms=["lumbar vertebra", "lumbar", "typical lumbar vertebra"]
    ),
    make_id_item(
        "vert_sacrum_pelvic",
        ["VERTEBRAE", "ALL"],
        "Identify this bone at a glance:",
        "Sacrum",
        "Pelvic / Anterior View",
        "Sacrum",
        ["Sacrum", "Coccyx", "Hip Bone", "Lumbar Vertebra"],
        "media/bones/image104.jpeg?v2",
        "bones_81",
        "Triangular bone formed by fusion of 5 sacral vertebrae. Concave pelvic surface features the anterior sacral promontory, lateral sacral wings (alae), 4 pairs of anterior pelvic sacral foramina, and 4 transverse lines.",
        "Pelvic surface is concave and smooth with large rounded pelvic sacral foramina.",
        synonyms=["sacrum", "os sacrum"]
    ),
    make_id_item(
        "vert_sacrum_dorsal",
        ["VERTEBRAE", "ALL"],
        "Identify this bone / view at a glance:",
        "Sacrum",
        "Dorsal / Posterior View",
        "Sacrum",
        ["Sacrum", "Occipital Bone", "Thoracic Vertebra", "Coccyx"],
        "media/bones/image105.jpeg?v2",
        "bones_82",
        "Convex rough dorsal surface with 5 longitudinal crests: 1 MEDIAN sacral crest (fused spines), 2 INTERMEDIATE crests (fused articular processes), 2 LATERAL crests (fused transverse processes), 4 pairs of dorsal sacral foramina, and inferior SACRAL HIATUS flanked by cornua.",
        "Sacral hiatus at S5 level is the clinical site for caudal epidural anesthesia.",
        synonyms=["sacrum", "os sacrum", "dorsal sacrum"]
    ),
]


# =====================================================================
# 3. LIMB BONES & TRICKY CONFUSIONS
# =====================================================================
LIMB_CONFUSION_ITEMS = [
    # Radius vs Ulna
    make_id_item(
        "limb_radius_vs_ulna_1",
        ["LIMBS", "ALL"],
        "Which antebrachial bone is this?",
        "Radius",
        "Full Anterior View",
        "Radius",
        ["Radius", "Ulna", "Fibula", "Humerus"],
        "media/bones/image49.jpeg?v2",
        "bones_36",
        "Proximal end has a small cylindrical DISC-LIKE HEAD with fovea; distal end is expanded with a lateral styloid process and carpal articular facet.",
        "Ulna has a massive wrench/hook (olecranon) proximally; Radius has a small circular wheel/disc head proximally.",
        synonyms=["radius", "os radius"]
    ),
    make_id_item(
        "limb_radius_vs_ulna_2",
        ["LIMBS", "ALL"],
        "Which antebrachial bone is this?",
        "Ulna",
        "Full Anterior View",
        "Ulna",
        ["Ulna", "Radius", "Fibula", "Tibia"],
        "media/bones/image57.jpeg?v2",
        "bones_42",
        "Proximal end is massive and hook-shaped (olecranon & coronoid process grasping trochlea of humerus); distal end is small and tapered with a small rounded head and styloid process.",
        "Radius is thicker distally; Ulna is much thicker proximally.",
        synonyms=["ulna", "os ulna"]
    ),

    # Tibia vs Fibula
    make_id_item(
        "limb_tibia_vs_fibula_1",
        ["LIMBS", "ALL"],
        "Which leg (crural) bone is this?",
        "Tibia",
        "Anterior & Posterior Shafts",
        "Tibia",
        ["Tibia", "Fibula", "Radius", "Femur"],
        "media/bones/image80.jpeg?v2",
        "bones_60",
        "Thick, massive weight-bearing bone. Sharp subcutaneous anterior border ('shin'), proximal expanded plateau, and prominent distal MEDIAL MALLEOLUS.",
        "Tibia carries 100% of body weight from femur; Fibula carries 0% of body weight and does not touch the knee joint.",
        synonyms=["tibia", "os tibia", "shin bone"]
    ),
    make_id_item(
        "limb_tibia_vs_fibula_2",
        ["LIMBS", "ALL"],
        "Which leg (crural) bone is this?",
        "Fibula",
        "Full Specimen View",
        "Fibula",
        ["Fibula", "Tibia", "Radius", "Ulna"],
        "media/bones/image89.jpeg?v2",
        "bones_67",
        "Very slender, twisted non-weight-bearing strut. Bulbous proximal head with pointed styloid apex; distal end forms the flattened LATERAL MALLEOLUS with malleolar fossa.",
        "Much more slender than Tibia; articulates laterally with tibia at both ends but NOT with femur.",
        synonyms=["fibula", "os fibula", "calf bone"]
    ),

    # Humerus vs Femur
    make_id_item(
        "limb_humerus_vs_femur_1",
        ["LIMBS", "ALL"],
        "Which long bone is this?",
        "Humerus",
        "Anterior Proximal View",
        "Humerus",
        ["Humerus", "Femur", "Tibia", "Radius"],
        "media/bones/image44.jpeg?v2",
        "bones_33",
        "Smooth hemispherical head sitting almost directly on anatomical neck; GREATER and LESSER TUBERCLES separated by deep intertubercular (bicipital) groove.",
        "Femur head has a distinct pit (fovea capitis) and a long, sharply angled neck (~125°); Humerus has NO fovea capitis and has greater/lesser TUBERCLES (not trochanters).",
        synonyms=["humerus", "os humerus", "arm bone"]
    ),
    make_id_item(
        "limb_humerus_vs_femur_2",
        ["LIMBS", "ALL"],
        "Which long bone is this?",
        "Femur",
        "Anterior & Posterior Proximal View",
        "Femur",
        ["Femur", "Humerus", "Tibia", "Hip Bone"],
        "media/bones/image72.jpeg?v2",
        "bones_54",
        "Massive hemispherical head with distinct central FOVEA CAPITIS, long cylindrical neck (~125° angle of inclination), massive GREATER TROCHANTER and lesser trochanter.",
        "Trochanters belong strictly to Femur! Tubercles belong to Humerus. Linea aspera on posterior shaft is pathognomonic of Femur.",
        synonyms=["femur", "os femur", "thigh bone"]
    ),

    # Clavicle vs Rib
    make_id_item(
        "limb_clavicle_vs_rib_1",
        ["LIMBS", "ALL"],
        "Identify this bone at a glance:",
        "Clavicle",
        "Superior View",
        "Clavicle",
        ["Clavicle", "Rib", "Fibula", "Mandible"],
        "media/bones/image24.jpeg?v2",
        "bones_23",
        "Double-curved elongated S-shaped bone. Bulbous rounded medial sternal end, flattened lateral acromial end, smooth superior surface.",
        "Rib has a single C-shaped curvature; Clavicle has a double S-shaped curvature. Clavicle has NO costal groove.",
        synonyms=["clavicle", "collar bone", "clavicula"]
    ),
    make_id_item(
        "limb_clavicle_vs_rib_2",
        ["LIMBS", "ALL"],
        "Identify this bone at a glance:",
        "Rib (Typical)",
        "Posterior View",
        "Rib (Typical)",
        ["Rib (Typical)", "Clavicle", "Fibula", "Scapula"],
        "media/bones/image1.jpeg?v2",
        "bones_01",
        "Single-curved flat C-shaped bone. Posterior vertebral end has head with two articular demifacets, neck, and tubercle; inferior border has deep costal groove on internal side.",
        "Clavicle is S-shaped with two distinct curvatures; Rib is a flat C-shaped arc with costal groove.",
        synonyms=["rib", "typical rib", "costa"]
    ),
    make_id_item(
        "limb_1st_rib",
        ["LIMBS", "ALL"],
        "Identify this specific rib at a glance:",
        "1st Rib",
        "Superior Surface",
        "1st Rib",
        ["1st Rib", "2nd Rib", "Typical Rib", "Clavicle"],
        "media/bones/image3.jpeg?v2",
        "bones_03",
        "SHORTEST, BROADEST, and MOST CURVED of all ribs. Lies almost horizontally. Features scalene tubercle on inner margin flanked by anterior sulcus for subclavian vein and posterior sulcus for subclavian artery.",
        "Lacks a costal groove; superior surface is marked by neurovascular grooves; 2nd rib is twice as long.",
        synonyms=["1st rib", "first rib", "rib 1"]
    ),
    make_id_item(
        "limb_2nd_rib",
        ["LIMBS", "ALL"],
        "Identify this specific rib at a glance:",
        "2nd Rib",
        "Superior / External Surface",
        "2nd Rib",
        ["2nd Rib", "1st Rib", "Typical Rib", "Clavicle"],
        "media/bones/image6.jpeg?v2",
        "bones_05",
        "Twice as long as 1st rib. Features a prominent rough TUBEROSITY FOR SERRATUS ANTERIOR (origin of 1st and 2nd digitation of serratus anterior) on its external surface.",
        "Pathognomonic tuberosity for serratus anterior near the middle of its outer surface.",
        synonyms=["2nd rib", "second rib", "rib 2"]
    ),
    make_id_item(
        "limb_sternum_whole",
        ["LIMBS", "ALL"],
        "Identify this thoracic wall bone at a glance:",
        "Sternum",
        "Anterior View",
        "Sternum",
        ["Sternum", "Rib", "Clavicle", "Sacrum"],
        "media/bones/image7.jpeg?v2",
        "bones_06",
        "Elongated flat 'dagger-shaped' bone in anterior thoracic midline. Composed of manubrium, body (mesosternum), and inferior xiphoid process. Sternal angle (angle of Louis) is at T4/T5 disc level (2nd rib landmark).",
        "Costal notches along lateral margins articulate with true ribs 1–7.",
        synonyms=["sternum", "breast bone", "sternal bone"]
    ),
    make_id_item(
        "limb_manubrium",
        ["LIMBS", "ALL"],
        "Identify this upper sternal segment at a glance:",
        "Manubrium of Sternum",
        "Anterior / Superior View",
        "Manubrium of Sternum",
        ["Manubrium of Sternum", "Sternal Body", "Xiphoid Process", "Atlas (C1)"],
        "media/bones/image9.jpeg?v2",
        "bones_08",
        "Thick quadrilateral / trapezoidal superior part of sternum. Superior border features central JUGULAR (suprasternal) NOTCH flanked by bilateral oval CLAVICULAR NOTCHES for sternoclavicular (SC) joints.",
        "Lateral border has synchondrosis facet for 1st rib cartilage; articulates inferiorly at sternal angle.",
        synonyms=["manubrium of sternum", "manubrium", "manubrium sterni"]
    ),
    make_id_item(
        "limb_scapula_vs_hip_1",
        ["LIMBS", "ALL"],
        "Identify this pectoral girdle bone at a glance:",
        "Scapula",
        "Posterior View",
        "Scapula",
        ["Scapula", "Hip Bone", "Sacrum", "Sternum"],
        "media/bones/image35.jpeg?v2",
        "bones_28",
        "Flat triangular blade on posterolateral thoracic wall. Easily identified by the prominent DORSAL SPINE terminating laterally in the flattened ACROMION, and the anterior beak-like CORACOID PROCESS.",
        "Shallow pear-shaped glenoid cavity articulates with humerus; hip bone has deep hemispherical acetabulum.",
        synonyms=["scapula", "shoulder blade", "omoplate"]
    ),
    make_id_item(
        "limb_scapula_vs_hip_2",
        ["LIMBS", "ALL"],
        "Identify this pelvic girdle bone at a glance:",
        "Hip Bone (Coxal Bone)",
        "Lateral View",
        "Hip Bone (Coxal Bone)",
        ["Hip Bone (Coxal Bone)", "Scapula", "Sacrum", "Occipital Bone"],
        "media/bones/image65.jpeg?v2",
        "bones_48",
        "Large irregular bone formed by fusion of ilium, ischium, and pubis. Identified by the massive cup-shaped ACETABULUM (hip socket), huge OBTURATOR FORAMEN, and GREATER SCIATIC NOTCH.",
        "Much thicker and heavier than scapula; forms pelvic ring with sacrum.",
        synonyms=["hip bone", "coxal bone", "os coxae", "pelvic bone", "innominate bone"]
    ),
]


# =====================================================================
# 4. CARPALS & HAND BONES
# =====================================================================
CARPALS_ITEMS = [
    make_id_item(
        "carpal_scaphoid",
        ["CARPALS", "ALL"],
        "Identify this carpal bone in the proximal row (radial side):",
        "Scaphoid",
        "Palmar / Anterior View",
        "Scaphoid",
        ["Scaphoid", "Lunate", "Triquetrum", "Trapezium"],
        "media/hand_foot/image1.png",
        None,
        "Largest bone of proximal carpal row, on radial side. Boat-shaped (navicular) with a prominent palpable tubercle on palmar surface. Articulates with radius. Most commonly fractured carpal bone (snuffbox tenderness; risk of avascular necrosis).",
        "Mnemonics: 'Some Lovers Try Positions...' (Scaphoid is first, radial side of proximal row).",
        synonyms=["scaphoid", "scaphoid bone", "os scaphoideum"]
    ),
    make_id_item(
        "carpal_lunate",
        ["CARPALS", "ALL"],
        "Identify this crescent-shaped carpal bone articulating with the radius:",
        "Lunate",
        "Palmar / Anterior View",
        "Lunate",
        ["Lunate", "Scaphoid", "Capitate", "Triquetrum"],
        "media/hand_foot/image1.png",
        None,
        "Crescent / moon-shaped proximal carpal bone between scaphoid and triquetrum. Articulates with radius. Most commonly DISLOCATED carpal bone (displaces anteriorly into carpal tunnel, compressing median nerve).",
        "Lunate = lunar / moon shape. Sits right in the midline of proximal row.",
        synonyms=["lunate", "lunate bone", "os lunatum"]
    ),
    make_id_item(
        "carpal_triquetrum",
        ["CARPALS", "ALL"],
        "Identify this carpal bone underlying the pisiform:",
        "Triquetrum",
        "Palmar / Anterior View",
        "Triquetrum",
        ["Triquetrum", "Pisiform", "Lunate", "Hamate"],
        "media/hand_foot/image1.png",
        None,
        "Pyramidal three-cornered bone medial to lunate on ulnar side of proximal row. Features an isolated oval articular facet on its palmar surface for the pisiform.",
        "Pisiform sits directly ON TOP of the triquetrum's palmar surface.",
        synonyms=["triquetrum", "triquetral bone", "os triquetrum"]
    ),
    make_id_item(
        "carpal_pisiform",
        ["CARPALS", "ALL"],
        "Identify this pea-shaped sesamoid carpal bone:",
        "Pisiform",
        "Palmar / Anterior View",
        "Pisiform",
        ["Pisiform", "Triquetrum", "Hamate", "Trapezium"],
        "media/hand_foot/image1.png",
        None,
        "Small pea-shaped sesamoid bone located entirely inside the flexor carpi ulnaris (FCU) tendon on palmar surface of triquetrum. Forms the medial pillar of the carpal tunnel.",
        "Pisiform is the ONLY sesamoid bone of the carpus and does not participate in wrist joint articulation.",
        synonyms=["pisiform", "pisiform bone", "os pisiforme"]
    ),
    make_id_item(
        "carpal_trapezium",
        ["CARPALS", "ALL"],
        "Identify this carpal bone with the saddle facet for the thumb:",
        "Trapezium",
        "Palmar / Anterior View",
        "Trapezium",
        ["Trapezium", "Trapezoid", "Capitate", "Scaphoid"],
        "media/hand_foot/image1.png",
        None,
        "Most lateral bone of the distal carpal row. Features a pathognomonic SADDLE-SHAPED articular facet for the base of the 1st metacarpal (thumb CMC joint allowing opposition) and an anterior tubercle.",
        "Trapezium = 'under the thumb'. Trapezoid is inside (under index finger).",
        synonyms=["trapezium", "trapezium bone", "os trapezium"]
    ),
    make_id_item(
        "carpal_trapezoid",
        ["CARPALS", "ALL"],
        "Identify this boot-shaped carpal bone under the index finger:",
        "Trapezoid",
        "Palmar / Anterior View",
        "Trapezoid",
        ["Trapezoid", "Trapezium", "Capitate", "Lunate"],
        "media/hand_foot/image1.png",
        None,
        "Smallest bone in the distal carpal row. Boot / shoe-shaped, articulates distally with the 2nd metacarpal base.",
        "TrapeziUM is near the thUMB; TrapezoID is InsiDe.",
        synonyms=["trapezoid", "trapezoid bone", "os trapezoideum"]
    ),
    make_id_item(
        "carpal_capitate",
        ["CARPALS", "ALL"],
        "Identify this largest carpal bone sitting in the center of the wrist:",
        "Capitate",
        "Palmar / Anterior View",
        "Capitate",
        ["Capitate", "Hamate", "Trapezoid", "Scaphoid"],
        "media/hand_foot/image1.png",
        None,
        "LARGEST carpal bone, sitting in the anatomical center of the wrist. Features a rounded head articulating with scaphoid and lunate, articulating distally mainly with 3rd metacarpal (longitudinal axis of hand).",
        "Capitate = 'head' / largest keystone carpal.",
        synonyms=["capitate", "capitate bone", "os capitatum"]
    ),
    make_id_item(
        "carpal_hamate",
        ["CARPALS", "ALL"],
        "Identify this carpal bone with a prominent hook (hamulus):",
        "Hamate",
        "Palmar / Anterior View",
        "Hamate",
        ["Hamate", "Capitate", "Pisiform", "Triquetrum"],
        "media/hand_foot/image1.png",
        None,
        "Wedge-shaped distal carpal bone on the ulnar side. Instantly recognized by its hook-like anterior projection: the HAMULUS (hook of hamate). Forms medial boundary of carpal tunnel and lateral wall of Guyon's canal (ulnar nerve).",
        "Hook of hamate fracture can injure the deep motor branch of ulnar nerve.",
        synonyms=["hamate", "hamate bone", "hook of hamate", "os hamatum"]
    ),
]


# =====================================================================
# 5. TARSALS & FOOT BONES
# =====================================================================
TARSALS_ITEMS = [
    make_id_item(
        "tarsal_calcaneus_specimen",
        ["TARSALS", "ALL"],
        "Identify this tarsal bone at a glance:",
        "Calcaneus",
        "Superior & Medial Surfaces",
        "Calcaneus",
        ["Calcaneus", "Talus", "Navicular", "Cuboid"],
        "media/bones/image94.jpeg?v2",
        "bones_71",
        "LARGEST tarsal bone (heel bone). Features massive posterior calcaneal tuber (insertion of Achilles tendon), three talar articular facets, and the medial horizontal shelf: SUSTENTACULUM TALI.",
        "Sustentaculum tali is grooved inferiorly by flexor hallucis longus (FHL) tendon.",
        synonyms=["calcaneus", "os calcis", "heel bone"]
    ),
    make_id_item(
        "tarsal_talus_specimen",
        ["TARSALS", "ALL"],
        "Identify this tarsal bone at a glance:",
        "Talus",
        "Superior View (Trochlea & Head)",
        "Talus",
        ["Talus", "Calcaneus", "Navicular", "Cuboid"],
        "media/bones/image98.jpeg?v2",
        "bones_75",
        "Second largest tarsal bone. Transmits 100% of body weight from leg to foot. HAS NO MUSCLE OR TENDON INSERTIONS! Composed of body with convex pulley-like TROCHLEA, neck, and rounded anterior head.",
        "Talus is the only tarsal bone articulating directly with the crural bones (tibia and fibula).",
        synonyms=["talus", "astragalus", "ankle bone"]
    ),
    make_id_item(
        "tarsal_navicular_diagram",
        ["TARSALS", "ALL"],
        "Identify this boat-shaped midfoot tarsal bone:",
        "Navicular",
        "Dorsal View",
        "Navicular",
        ["Navicular", "Cuboid", "Medial Cuneiform", "Talus"],
        "media/hand_foot/image4.jpeg",
        None,
        "Boat-shaped bone on medial side of midfoot between talar head and the 3 cuneiforms. Features a prominent, palpable medial NAVICULAR TUBEROSITY (insertion of TIBIALIS POSTERIOR tendon; keystone of medial longitudinal arch).",
        "Navicular = boat (like scaphoid). Sits on MEDIAL side of foot between talus and 3 cuneiforms.",
        synonyms=["navicular", "navicular bone", "os naviculare"]
    ),
    make_id_item(
        "tarsal_cuboid_diagram",
        ["TARSALS", "ALL"],
        "Identify this cube-shaped lateral midfoot tarsal bone:",
        "Cuboid",
        "Dorsal View",
        "Cuboid",
        ["Cuboid", "Navicular", "Lateral Cuneiform", "Calcaneus"],
        "media/hand_foot/image4.jpeg",
        None,
        "Cube-shaped bone on the LATERAL side of midfoot, articulating proximally with calcaneus and distally with 4th and 5th metatarsals. Plantar surface has a deep oblique GROOVE FOR FIBULARIS (PERONEUS) LONGUS TENDON.",
        "Cuboid sits on LATERAL side in front of calcaneus; Navicular sits on MEDIAL side in front of talus.",
        synonyms=["cuboid", "cuboid bone", "os cuboideum"]
    ),
    make_id_item(
        "tarsal_medial_cuneiform",
        ["TARSALS", "ALL"],
        "Identify this largest cuneiform bone (medial border of foot):",
        "Medial Cuneiform",
        "Dorsal View",
        "Medial Cuneiform",
        ["Medial Cuneiform", "Intermediate Cuneiform", "Lateral Cuneiform", "Navicular"],
        "media/hand_foot/image4.jpeg",
        None,
        "LARGEST of the three cuneiform bones. Sits on the medial border of the foot, articulating distally with the base of the 1st metatarsal (tibialis anterior and fibularis longus insert on its anteroinferior surface).",
        "Medial cuneiform is largest; intermediate cuneiform is smallest.",
        synonyms=["medial cuneiform", "first cuneiform", "os cuneiforme mediale", "1st cuneiform"]
    ),
    make_id_item(
        "tarsal_intermediate_cuneiform",
        ["TARSALS", "ALL"],
        "Identify this smallest cuneiform bone recessed between medial & lateral cuneiforms:",
        "Intermediate Cuneiform",
        "Dorsal View",
        "Intermediate Cuneiform",
        ["Intermediate Cuneiform", "Medial Cuneiform", "Lateral Cuneiform", "Cuboid"],
        "media/hand_foot/image4.jpeg",
        None,
        "SMALLEST of the three cuneiforms. Wedge-shaped with apex pointing plantarward. Recessed proximally between medial and lateral cuneiforms, locking the 2nd metatarsal base into a mortise ('mortise of Lisfranc joint').",
        "Locks 2nd metatarsal base in place like a tenon and mortise.",
        synonyms=["intermediate cuneiform", "second cuneiform", "middle cuneiform", "os cuneiforme intermedium", "2nd cuneiform"]
    ),
    make_id_item(
        "tarsal_lateral_cuneiform",
        ["TARSALS", "ALL"],
        "Identify this cuneiform bone articulating with the cuboid:",
        "Lateral Cuneiform",
        "Dorsal View",
        "Lateral Cuneiform",
        ["Lateral Cuneiform", "Intermediate Cuneiform", "Medial Cuneiform", "Cuboid"],
        "media/hand_foot/image4.jpeg",
        None,
        "Intermediate in size, wedge-shaped with base dorsal. Sits between intermediate cuneiform and cuboid, articulating distally with the base of the 3rd metatarsal.",
        "Articulates laterally with the cuboid bone.",
        synonyms=["lateral cuneiform", "third cuneiform", "os cuneiforme laterale", "3rd cuneiform"]
    ),
]


# =====================================================================
# 6. CRANIAL & FACIAL BONES AT A GLANCE
# =====================================================================
SKULL_ITEMS = [
    make_id_item(
        "skull_sphenoid_bone",
        ["SKULL", "ALL"],
        "Identify this butterfly-shaped skull base bone:",
        "Sphenoid Bone",
        "Internal Cranial Base View",
        "Sphenoid Bone",
        ["Sphenoid Bone", "Ethmoid Bone", "Temporal Bone", "Occipital Bone"],
        "media/skull/image11.jpeg?v2",
        "skull_06",
        "Butterfly / bat-shaped keystone bone of the skull base. Greater wings, lesser wings, pterygoid processes, and central body with sella turcica (hypophysial fossa) housing the pituitary gland.",
        "Forms central part of middle cranial fossa; transmits CN II (optic canal), CN III, IV, V1, VI (SOF), V2 (foramen rotundum), V3 (foramen ovale).",
        synonyms=["sphenoid bone", "sphenoid", "os sphenoidale"]
    ),
    make_id_item(
        "skull_temporal_bone",
        ["SKULL", "ALL"],
        "Identify this bone housing the auditory and vestibular apparatus:",
        "Temporal Bone",
        "Lateral Skull View",
        "Temporal Bone",
        ["Temporal Bone", "Sphenoid Bone", "Parietal Bone", "Zygomatic Bone"],
        "media/skull/image4.jpeg?v2",
        "skull_02",
        "Houses the middle and inner ear. Composed of squamous part, petrous part (pyramid with arcuate eminence & trigeminal impression), tympanic part (surrounds EAM), and styloid/mastoid processes.",
        "Features mandibular fossa for TMJ, external & internal acoustic meati, carotid canal, and stylomastoid foramen (CN VII exit).",
        synonyms=["temporal bone", "temporal", "os temporale"]
    ),
    make_id_item(
        "skull_occipital_bone",
        ["SKULL", "ALL"],
        "Identify this posterior cranial fossa & cranial base bone:",
        "Occipital Bone",
        "External Base View",
        "Occipital Bone",
        ["Occipital Bone", "Sphenoid Bone", "Temporal Bone", "Parietal Bone"],
        "media/skull/image16.jpeg?v2",
        "skull_08",
        "Forms the posterior cranial fossa and external cranial base. Features the massive FORAMEN MAGNUM, paired occipital condyles (atlanto-occipital joint), pharyngeal tubercle on basilar part, and external occipital protuberance (inion).",
        "Occipital condyles articulate directly with the superior articular facets of the Atlas (C1).",
        synonyms=["occipital bone", "occipital", "os occipitale"]
    ),
    make_id_item(
        "skull_mandible_bone",
        ["SKULL", "ALL"],
        "Identify this lower jaw bone at a glance:",
        "Mandible",
        "Medial Ramus & Body View",
        "Mandible",
        ["Mandible", "Maxilla", "Zygomatic Bone", "Hyoid Bone"],
        "media/skull/image26.jpeg?v2",
        "skull_18",
        "Strongest, largest, and ONLY mobile bone of the facial skeleton (viscerocranium). Horseshoe-shaped horizontal body and two vertical rami. Coronoid process anteriorly, condylar process (head of mandible) posteriorly, mental foramen, and mandibular canal with lingula.",
        "Articulates with temporal bone at the temporomandibular joint (TMJ).",
        synonyms=["mandible", "mandibular bone", "lower jaw", "mandibula"]
    ),
    make_id_item(
        "skull_hyoid_bone",
        ["SKULL", "ALL"],
        "Identify this non-articulating U-shaped neck bone at a glance:",
        "Hyoid Bone",
        "Anterior / Superior View",
        "Hyoid Bone",
        ["Hyoid Bone", "Mandible", "Atlas (C1)", "Thyroid Cartilage"],
        "media/skull/image30.jpeg?v2",
        "skull_20",
        "U-shaped bone in the anterior neck at C3 level. DOES NOT ARTICULATE WITH ANY OTHER BONE (suspended by muscles and stylohyoid ligament). Composed of a central body, bilateral GREATER HORNS (cornua), and small upward LESSER HORNS.",
        "Serves as attachment site for suprahyoid and infrahyoid strap muscles and tongue musculature.",
        synonyms=["hyoid bone", "hyoid", "os hyoideum"]
    ),
    make_id_item(
        "skull_parietal_bone",
        ["SKULL", "ALL"],
        "Identify this cranial vault bone at a glance:",
        "Parietal Bone",
        "Lateral Calvaria View",
        "Parietal Bone",
        ["Parietal Bone", "Frontal Bone", "Occipital Bone", "Temporal Bone"],
        "media/skull/image8.jpeg?v2",
        "skull_04",
        "Quadrilateral curved bone forming the vertex and lateral sides of the cranial vault. Prominent central parietal tuber (eminence); articulates with frontal bone at coronal suture and occipital bone at lambdoid suture.",
        "Grooved internally by anterior and posterior branches of the middle meningeal artery.",
        synonyms=["parietal bone", "parietal", "os parietale"]
    ),
    make_id_item(
        "skull_frontal_bone",
        ["SKULL", "ALL"],
        "Identify this anterior neurocranium bone at a glance:",
        "Frontal Bone",
        "Anterior / Facial View",
        "Frontal Bone",
        ["Frontal Bone", "Parietal Bone", "Maxilla", "Sphenoid Bone"],
        "media/skull/image1.jpeg?v2",
        "skull_01",
        "Shell-shaped bone forming forehead and roofs of orbits. Features smooth median GLABELLA, prominent SUPERCILIARY ARCHES, and sharp SUPRAORBITAL MARGINS with supraorbital notch/foramen (for CN V1 branches).",
        "Contains the bilateral frontal paranasal sinuses draining into the middle nasal meatus.",
        synonyms=["frontal bone", "frontal", "os frontale"]
    ),
    make_id_item(
        "skull_hard_palate",
        ["SKULL", "ALL"],
        "Identify this bony structure forming the roof of the oral cavity:",
        "Hard Palate (Palatine & Maxilla)",
        "Inferior View",
        "Hard Palate (Palatine & Maxilla)",
        ["Hard Palate (Palatine & Maxilla)", "Mandible", "Sphenoid Bone", "Occipital Bone"],
        "media/skull/image16.jpeg?v2",
        "skull_17",
        "Bony roof of the mouth and floor of the nasal cavity. Formed anterior 2/3 by PALATINE PROCESSES OF MAXILLAE and posterior 1/3 by HORIZONTAL PLATES OF PALATINE BONES, joined by median and transverse palatine sutures.",
        "Features incisive canal anteriorly and greater/lesser palatine foramina posterolaterally.",
        synonyms=["hard palate", "palatine bone", "palatum durum", "palatine"]
    ),
    make_id_item(
        "skull_orbit_sphenoid",
        ["SKULL", "ALL"],
        "Identify the deep orbital bones forming the Superior Orbital Fissure:",
        "Sphenoid Bone (Orbital Surface)",
        "Anterior Orbital View",
        "Sphenoid Bone",
        ["Sphenoid Bone", "Ethmoid Bone", "Frontal Bone", "Zygomatic Bone"],
        "media/skull/image1.jpeg?v2",
        "skull_09",
        "Posterior wall of orbit. SUPERIOR ORBITAL FISSURE separates the upper LESSER WING from the lower GREATER WING of the sphenoid bone. Transmits CN III, IV, V1 (lacrimal, frontal, nasociliary), VI, and superior ophthalmic vein.",
        "Lesser wing forms upper margin of SOF and optic canal; Greater wing forms lower margin.",
        synonyms=["sphenoid bone", "sphenoid", "os sphenoidale", "sphenoid wings"]
    ),
    make_id_item(
        "skull_mandible_chin",
        ["SKULL", "ALL"],
        "Identify this bone from its internal posterior symphyseal view:",
        "Mandible (Internal Surface)",
        "Posterior / Internal View of Chin",
        "Mandible",
        ["Mandible", "Hyoid Bone", "Atlas (C1)", "Maxilla"],
        "media/skull/image28.jpeg?v2",
        "skull_19",
        "Internal surface of mandibular symphysis (chin). Features bilateral oval DIGASTRIC FOSSAE (anterior belly of digastric), MENTAL SPINES / genial tubercles (genioglossus & geniohyoid), SUBLINGUAL FOSSA superiorly, and MYLOHYOID LINE.",
        "Genial tubercles / mental spines project from internal midline; digastric fossa sits along lower border.",
        synonyms=["mandible", "mandibular bone", "mandibula"]
    ),
]


# Combine all items into master dataset
BONE_ID_ITEMS = SIDING_ITEMS + VERTEBRAE_ITEMS + LIMB_CONFUSION_ITEMS + CARPALS_ITEMS + TARSALS_ITEMS + SKULL_ITEMS

if __name__ == "__main__":
    print(f"Total Bone ID & Siding items: {len(BONE_ID_ITEMS)}")
    by_cat = {}
    for item in BONE_ID_ITEMS:
        for c in item["categories"]:
            by_cat[c] = by_cat.get(c, 0) + 1
    for c, cnt in sorted(by_cat.items()):
        print(f"  {c:15s}: {cnt} items")
