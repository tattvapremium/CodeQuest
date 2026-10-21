from models import SessionLocal, Concept, Problem, TestCase


def seed_problems():
    db = SessionLocal()

    concepts = [
        {
            "id": "C_PRIME",
            "name": "Prime Checking",
            "axis": "number_theory",
            "level": "beginner",
            "mental_model": "A prime has exactly two positive divisors: 1 and itself.",
            "repair_strategy": "Test divisibility from 2 to sqrt(n) and handle n <= 1 early.",
        },
        {
            "id": "C_SUM",
            "name": "Accumulation with Loops",
            "axis": "iteration",
            "level": "beginner",
            "mental_model": "Maintain a running total while iterating through values.",
            "repair_strategy": "Initialize an accumulator and add each parsed input value.",
        },
        {
            "id": "C_PAL",
            "name": "String Palindrome Logic",
            "axis": "strings",
            "level": "beginner",
            "mental_model": "A string is palindrome if it equals its reverse.",
            "repair_strategy": "Normalize input if needed and compare original vs reversed string.",
        },
        {
            "id": "C_MAX",
            "name": "Maximum Selection",
            "axis": "iteration",
            "level": "beginner",
            "mental_model": "Track the best value seen so far while scanning inputs.",
            "repair_strategy": "Initialize max from first value, then update when larger value appears.",
        },
        {
            "id": "C_PARITY",
            "name": "Parity with Modulo",
            "axis": "arithmetic",
            "level": "beginner",
            "mental_model": "Parity is determined by remainder when dividing by 2.",
            "repair_strategy": "Use n % 2 == 0 for even, else odd.",
        },
    ]

    for concept_data in concepts:
        existing = db.query(Concept).filter(Concept.id == concept_data["id"]).first()
        if not existing:
            db.add(Concept(**concept_data))

    problems = [
        {
            "title": "Check Prime Number",
            "description": "Read an integer and print 'Prime' if it is a prime number, otherwise print 'Not Prime'.",
            "difficulty": "beginner",
            "order_index": 1,
            "concept_id": "C_PRIME",
            "starter_code": "# Read integer and check prime\n",
            "input_format": "An integer N",
            "output_format": "Prime or Not Prime",
            "hints": ["Check divisibility till sqrt(n)", "Handle n <= 1"],
            "tests": [
                ("7", "Prime", True),
                ("10", "Not Prime", True),
                ("1", "Not Prime", False),
                ("13", "Prime", False),
            ],
        },
        {
            "title": "Sum of N Numbers",
            "description": "Read N followed by N integers and print their sum.",
            "difficulty": "beginner",
            "order_index": 2,
            "concept_id": "C_SUM",
            "starter_code": "# Read N and sum values\n",
            "input_format": "N followed by N integers",
            "output_format": "Sum of the numbers",
            "hints": ["Use a loop", "Convert input to int"],
            "tests": [
                ("3\n5\n10\n15", "30", True),
                ("1\n100", "100", True),
                ("5\n1\n2\n3\n4\n5", "15", False),
            ],
        },
        {
            "title": "Palindrome String",
            "description": "Read a string and print 'Palindrome' if it reads the same forwards and backwards.",
            "difficulty": "beginner",
            "order_index": 3,
            "concept_id": "C_PAL",
            "starter_code": "# Check palindrome\n",
            "input_format": "A single string",
            "output_format": "Palindrome or Not Palindrome",
            "hints": ["Reverse string", "Compare"],
            "tests": [
                ("racecar", "Palindrome", True),
                ("hello", "Not Palindrome", True),
                ("madam", "Palindrome", False),
            ],
        },
        {
            "title": "Find Maximum",
            "description": "Read N integers and print the maximum value.",
            "difficulty": "beginner",
            "order_index": 4,
            "concept_id": "C_MAX",
            "starter_code": "# Find maximum number\n",
            "input_format": "N followed by N integers",
            "output_format": "Maximum number",
            "hints": ["Track max value"],
            "tests": [
                ("3\n1\n5\n2", "5", True),
                ("1\n99", "99", True),
                ("5\n-1\n-2\n-3\n-4\n-5", "-1", False),
            ],
        },
        {
            "title": "Even or Odd",
            "description": "Read an integer and print 'Even' or 'Odd'.",
            "difficulty": "beginner",
            "order_index": 5,
            "concept_id": "C_PARITY",
            "starter_code": "# Check even or odd\n",
            "input_format": "A single integer",
            "output_format": "Even or Odd",
            "hints": ["Use modulo operator"],
            "tests": [
                ("4", "Even", True),
                ("7", "Odd", True),
                ("0", "Even", False),
            ],
        },
    ]

    for p in problems:
        problem = Problem(
            title=p["title"],
            description=p["description"],
            difficulty=p["difficulty"],
            order_index=p["order_index"],
            concept_id=p["concept_id"],
            starter_code=p["starter_code"],
            input_format=p["input_format"],
            output_format=p["output_format"],
            hints=p["hints"],
        )

        db.add(problem)
        db.flush()  # get problem.id

        for input_data, expected, is_sample in p["tests"]:
            test_case = TestCase(
                problem_id=problem.id,
                input_data=input_data,
                expected_output=expected,
                is_sample=is_sample,
                is_hidden=not is_sample,
                points=10,
            )
            db.add(test_case)

    db.commit()
    db.close()
    print("✅ 5 problems and test cases inserted successfully")


if __name__ == "__main__":
    seed_problems()
