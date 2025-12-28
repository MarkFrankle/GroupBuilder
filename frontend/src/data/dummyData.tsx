// Dummy data for local development - 20 participants
// 17 from main three faiths (Christian, Jewish, Muslim)
// 4 singles, 8 couples (16 people)
// Names range from short to very long
export const dummyData = [
  {
    session: 1,
    tables: {
      1: [
        { name: "Jo Lee", religion: "Christian", gender: "Female", partner: "Sam Wu" },
        { name: "Sam Wu", religion: "Christian", gender: "Male", partner: "Jo Lee" },
        { name: "Li Chen", religion: "Muslim", gender: "Female", partner: null },
        { name: "Sarah Cohen", religion: "Jewish", gender: "Female", partner: "David Cohen" },
        { name: "Raj Patel", religion: "Hindu", gender: "Male", partner: null }
      ],
      2: [
        { name: "David Cohen", religion: "Jewish", gender: "Male", partner: "Sarah Cohen" },
        { name: "Maria Rodriguez", religion: "Christian", gender: "Female", partner: "Carlos Rodriguez" },
        { name: "Aisha Hassan", religion: "Muslim", gender: "Female", partner: "Omar Hassan" },
        { name: "Emma Thompson", religion: "Christian", gender: "Female", partner: null },
        { name: "Yuki Tanaka", religion: "Buddhist", gender: "Female", partner: "Kenji Tanaka" }
      ],
      3: [
        { name: "Carlos Rodriguez", religion: "Christian", gender: "Male", partner: "Maria Rodriguez" },
        { name: "Omar Hassan", religion: "Muslim", gender: "Male", partner: "Aisha Hassan" },
        { name: "Rebecca Goldstein-Meyer", religion: "Jewish", gender: "Female", partner: "Michael Goldstein-Meyer" },
        { name: "Kenji Tanaka", religion: "None", gender: "Male", partner: "Yuki Tanaka" },
        { name: "Noah Kim", religion: "Christian", gender: "Male", partner: null }
      ],
      4: [
        { name: "Michael Goldstein-Meyer", religion: "Jewish", gender: "Male", partner: "Rebecca Goldstein-Meyer" },
        { name: "Fatima Al-Rashid", religion: "Muslim", gender: "Female", partner: "Ahmed Al-Rashid" },
        { name: "Ahmed Al-Rashid", religion: "Muslim", gender: "Male", partner: "Fatima Al-Rashid" },
        { name: "Christopher Montgomery-Wellington", religion: "Jewish", gender: "Male", partner: "Elizabeth Montgomery-Wellington" },
        { name: "Elizabeth Montgomery-Wellington", religion: "Jewish", gender: "Female", partner: "Christopher Montgomery-Wellington" }
      ]
    }
  },
  {
    session: 2,
    tables: {
      1: [
        { name: "Emma Thompson", religion: "Christian", gender: "Female", partner: null },
        { name: "Ahmed Al-Rashid", religion: "Muslim", gender: "Male", partner: "Fatima Al-Rashid" },
        { name: "Rebecca Goldstein-Meyer", religion: "Jewish", gender: "Female", partner: "Michael Goldstein-Meyer" },
        { name: "Sam Wu", religion: "Christian", gender: "Male", partner: "Jo Lee" },
        { name: "Yuki Tanaka", religion: "Buddhist", gender: "Female", partner: "Kenji Tanaka" }
      ],
      2: [
        { name: "Jo Lee", religion: "Christian", gender: "Female", partner: "Sam Wu" },
        { name: "Raj Patel", religion: "Hindu", gender: "Male", partner: null },
        { name: "Elizabeth Montgomery-Wellington", religion: "Jewish", gender: "Female", partner: "Christopher Montgomery-Wellington" },
        { name: "Maria Rodriguez", religion: "Christian", gender: "Female", partner: "Carlos Rodriguez" },
        { name: "Li Chen", religion: "Muslim", gender: "Female", partner: null }
      ],
      3: [
        { name: "Carlos Rodriguez", religion: "Christian", gender: "Male", partner: "Maria Rodriguez" },
        { name: "Sarah Cohen", religion: "Jewish", gender: "Female", partner: "David Cohen" },
        { name: "Fatima Al-Rashid", religion: "Muslim", gender: "Female", partner: "Ahmed Al-Rashid" },
        { name: "Kenji Tanaka", religion: "None", gender: "Male", partner: "Yuki Tanaka" },
        { name: "Noah Kim", religion: "Christian", gender: "Male", partner: null }
      ],
      4: [
        { name: "David Cohen", religion: "Jewish", gender: "Male", partner: "Sarah Cohen" },
        { name: "Christopher Montgomery-Wellington", religion: "Jewish", gender: "Male", partner: "Elizabeth Montgomery-Wellington" },
        { name: "Aisha Hassan", religion: "Muslim", gender: "Female", partner: "Omar Hassan" },
        { name: "Omar Hassan", religion: "Muslim", gender: "Male", partner: "Aisha Hassan" },
        { name: "Michael Goldstein-Meyer", religion: "Jewish", gender: "Male", partner: "Rebecca Goldstein-Meyer" }
      ]
    }
  },
  {
    session: 3,
    tables: {
      1: [
        { name: "Noah Kim", religion: "Christian", gender: "Male", partner: null },
        { name: "Fatima Al-Rashid", religion: "Muslim", gender: "Female", partner: "Ahmed Al-Rashid" },
        { name: "Jo Lee", religion: "Christian", gender: "Female", partner: "Sam Wu" },
        { name: "Michael Goldstein-Meyer", religion: "Jewish", gender: "Male", partner: "Rebecca Goldstein-Meyer" },
        { name: "Yuki Tanaka", religion: "Buddhist", gender: "Female", partner: "Kenji Tanaka" }
      ],
      2: [
        { name: "Sam Wu", religion: "Christian", gender: "Male", partner: "Jo Lee" },
        { name: "Li Chen", religion: "Muslim", gender: "Female", partner: null },
        { name: "David Cohen", religion: "Jewish", gender: "Male", partner: "Sarah Cohen" },
        { name: "Carlos Rodriguez", religion: "Christian", gender: "Male", partner: "Maria Rodriguez" },
        { name: "Kenji Tanaka", religion: "None", gender: "Male", partner: "Yuki Tanaka" }
      ],
      3: [
        { name: "Maria Rodriguez", religion: "Christian", gender: "Female", partner: "Carlos Rodriguez" },
        { name: "Christopher Montgomery-Wellington", religion: "Jewish", gender: "Male", partner: "Elizabeth Montgomery-Wellington" },
        { name: "Ahmed Al-Rashid", religion: "Muslim", gender: "Male", partner: "Fatima Al-Rashid" },
        { name: "Emma Thompson", religion: "Christian", gender: "Female", partner: null },
        { name: "Raj Patel", religion: "Hindu", gender: "Male", partner: null }
      ],
      4: [
        { name: "Sarah Cohen", religion: "Jewish", gender: "Female", partner: "David Cohen" },
        { name: "Elizabeth Montgomery-Wellington", religion: "Jewish", gender: "Female", partner: "Christopher Montgomery-Wellington" },
        { name: "Aisha Hassan", religion: "Muslim", gender: "Female", partner: "Omar Hassan" },
        { name: "Omar Hassan", religion: "Muslim", gender: "Male", partner: "Aisha Hassan" },
        { name: "Rebecca Goldstein-Meyer", religion: "Jewish", gender: "Female", partner: "Michael Goldstein-Meyer" }
      ]
    }
  }
]
