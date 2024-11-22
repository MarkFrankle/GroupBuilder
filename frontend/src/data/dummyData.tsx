// Dummy data for local development
export const dummyData = [
  {
    session: 1,
    tables: {
    1: [
        { name: "Alice", religion: "Christian", gender: "Female", partner: "Bob" },
        { name: "Bob", religion: "Jewish", gender: "Male", partner: "Alice" },
        { name: "Charlie", religion: "Muslim", gender: "Male", partner: null }
    ],
    2: [
        { name: "David", religion: "Hindu", gender: "Male", partner: "Eve" },
        { name: "Eve", religion: "Buddhist", gender: "Female", partner: "David" },
        { name: "Frank", religion: "Atheist", gender: "Male", partner: null }
    ]
    }
},
{
    session: 2,
    tables: {
    1: [
        { name: "Eve", religion: "Buddhist", gender: "Female", partner: "David" },
        { name: "Charlie", religion: "Muslim", gender: "Male", partner: null },
        { name: "David", religion: "Hindu", gender: "Male", partner: "Eve" },
    ],
    2: [
        { name: "Frank", religion: "Atheist", gender: "Male", partner: null },
        { name: "Alice", religion: "Christian", gender: "Female", partner: "Bob" },
        { name: "Bob", religion: "Jewish", gender: "Male", partner: "Alice" },
    ]
    }
},
{
    session: 3,
    tables: {
    1: [
        { name: "Bob", religion: "Jewish", gender: "Male", partner: "Alice" },
        { name: "Frank", religion: "Atheist", gender: "Male", partner: null },
        { name: "Eve", religion: "Buddhist", gender: "Female", partner: "David" },
    ],
    2: [
        { name: "Charlie", religion: "Muslim", gender: "Male", partner: null },
        { name: "Alice", religion: "Christian", gender: "Female", partner: "Bob" },
        { name: "David", religion: "Hindu", gender: "Male", partner: "Eve" },
    ]
    }
  }
]