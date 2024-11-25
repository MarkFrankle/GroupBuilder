from collections import defaultdict
from math import ceil
from ortools.sat.python import cp_model


class GroupBuilder:
    def __init__(self, participants, num_tables, num_sessions):
        self.participants = participants
        self.tables = range(num_tables)
        self.sessions = range(num_sessions)
        self.table_size = ceil(len(self.participants) / len(self.tables))
        self.religions = set([p["religion"] for p in self.participants])
        self.genders = set([p["gender"] for p in self.participants])

    def generate_assignments(self) -> dict:
        self.setup_model()
        self._add_constraints_to_model()
        self._add_objective_functions_to_model()
        return self._run_solver()

    def setup_model(self):
        self.model = cp_model.CpModel()

        # Decision variables
        # x[p,t,s] -> is [p]articipant sitting at [t]able in [s]ession
        self.x = {}
        for p in self.participants:
            for s in self.sessions:
                for t in self.tables:
                    self.x[(p["id"], s, t)] = self.model.NewBoolVar(
                        f"x_p{p['id']}_s{s}_t{t}"
                    )

    def _add_constraints_to_model(self):
        # Each participants sits at one table per session
        for p in self.participants:
            for s in self.sessions:
                self.model.Add(sum(self.x[(p["id"], s, t)] for t in self.tables) == 1)

        # All tables are within 1 participant of all other tables
        max_participants = {}
        min_participants = {}

        for s in self.sessions:
            max_participants[s] = self.model.NewIntVar(
                0, len(self.participants), f"max_participants_s{s}"
            )
            min_participants[s] = self.model.NewIntVar(
                0, len(self.participants), f"min_participants_s{s}"
            )

            for t in self.tables:
                table_participant_count = sum(
                    self.x[(p["id"], s, t)] for p in self.participants
                )
                self.model.Add(max_participants[s] >= table_participant_count)
                self.model.Add(min_participants[s] <= table_participant_count)

            self.model.Add(max_participants[s] - min_participants[s] <= 1)

            # No table has more than one participant from a religion than any other table
        self._add_participant_attribute_distribution_constraint(
            "religion", self.religions
        )
        # No table has more than one participant from a religion than any other table
        self._add_participant_attribute_distribution_constraint("gender", self.genders)

    def _add_participant_attribute_distribution_constraint(
        self, attribute_name, attribute_set
    ) -> None:
        max_participants_per_attribute = {}
        min_participants_per_attribute = {}

        for s in self.sessions:
            for attribute_value in attribute_set:
                max_participants_per_attribute[(s, attribute_value)] = (
                    self.model.NewIntVar(
                        0,
                        len(self.participants),
                        f"max_participants_{attribute_name}_s{s}_{attribute_name[0]}{attribute_value}",
                    )
                )
                min_participants_per_attribute[(s, attribute_value)] = (
                    self.model.NewIntVar(
                        0,
                        len(self.participants),
                        f"min_participants_{attribute_name}_s{s}_{attribute_name[0]}{attribute_value}",
                    )
                )

                for t in self.tables:
                    table_participant_count_per_attribute = sum(
                        self.x[(p["id"], s, t)]
                        for p in self.participants
                        if p[attribute_name] == attribute_value
                    )
                    self.model.Add(
                        max_participants_per_attribute[(s, attribute_value)]
                        >= table_participant_count_per_attribute
                    )
                    self.model.Add(
                        min_participants_per_attribute[(s, attribute_value)]
                        <= table_participant_count_per_attribute
                    )

                self.model.Add(
                    max_participants_per_attribute[(s, attribute_value)]
                    - min_participants_per_attribute[(s, attribute_value)]
                    <= 1
                )

    def _add_objective_functions_to_model(self):
        # Separate couples as much as possible
        couples = defaultdict(list)
        for p in self.participants:
            if p["couple_id"]:
                couples[p["couple_id"]].append(p)

        for s in self.sessions:
            for t in self.tables:
                for group in couples.values():
                    self.model.Add(sum(self.x[(p["id"], s, t)] for p in group) <= 1)

        weighted_actual_pairings = 0
        for s in self.sessions:
            session_weight = len(self.sessions) - s
            for t in self.tables:
                for p1 in self.participants:
                    for p2 in self.participants:
                        if p2["id"] <= p1["id"]:
                            continue
                        z = self.model.NewBoolVar(
                            f'pairing_p1{p1["id"]}_p2{p2["id"]}_s{s}_t{t}'
                        )
                        self.model.Add(z <= self.x[(p1["id"], s, t)])
                        self.model.Add(z <= self.x[(p2["id"], s, t)])
                        self.model.Add(
                            z >= self.x[(p1["id"], s, t)] + self.x[(p2["id"], s, t)] - 1
                        )
                        weighted_actual_pairings += session_weight * z
        self.model.Minimize(weighted_actual_pairings)

    def _run_solver(self):
        self.solver = cp_model.CpSolver()
        status = self.solver.Solve(self.model)

        if status in [cp_model.FEASIBLE, cp_model.OPTIMAL]:
            assignments = []

            for s in self.sessions:
                session_data = {"session": s + 1, "tables": defaultdict(list)}
                for t in self.tables:
                    for p in self.participants:
                        if self.solver.BooleanValue(self.x[(p["id"], s, t)]):
                            session_data["tables"][t + 1].append(
                                {
                                    "name": p["name"],
                                    "religion": p["religion"],
                                    "gender": p["gender"],
                                    "couple_id": p["couple_id"],
                                }
                            )
                # Convert defaultdict to a regular dict for JSON compatibility
                session_data["tables"] = dict(session_data["tables"])
                assignments.append(session_data)
            return {
                "status": "success",
                "total_deviation": self.solver.ObjectiveValue(),
                "assignments": assignments,
            }
        else:
            return {"status": "failure"}


if __name__ == "__main__":
    # Data input
    # data = {
    #     'Name': [
    #         'John Doe', 'Jane Doe', 'Ali Hassan', 'Rachel Green', 'Ross Green',
    #         'Chandler Bing', 'Monica', 'Joey', 'Phoebe', 'Akshay',
    #         'Jessica', 'Mike', 'Anwar', 'Sarah', 'Ethan',
    #         'Priya', 'Raj', 'Emily', 'Tariq', 'Sophia'
    #     ],
    #     'Religion': [
    #         'Christian', 'Christian', 'Muslim', 'Jewish', 'Jewish',
    #         'other', 'Muslim', 'Jewish', 'Christian', 'Muslim',
    #         'Christian', 'Muslim', 'Muslim', 'Jewish', 'Jewish',
    #         'Christian', 'other', 'other', 'Muslim', 'Christian'
    #     ],
    #     'Gender': [
    #         'Male', 'Female', 'Male', 'Female', 'Male',
    #         'Male', 'Female', 'Male', 'Female', 'Male',
    #         'Female', 'Male', 'Male', 'Female', 'Male',
    #         'Female', 'Male', 'Female', 'Male', 'Female'
    #     ],
    #     'Partner': [
    #         'Jane Doe', 'John Doe', None, 'Ross Green', 'Rachel Green',
    #         None, None, None, None, None,
    #         'Mike', 'Jessica', 'Sarah', 'Anwar', 'Priya',
    #         'Ethan', 'Emily', 'Raj', 'Sophia', 'Tariq'
    #     ]
    # }

    data = [
        {
            "id": 1,
            "name": "John Doe",
            "religion": "Christian",
            "gender": "Male",
            "couple_id": 1,
        },
        {
            "id": 2,
            "name": "Jane Doe",
            "religion": "Christian",
            "gender": "Female",
            "couple_id": 1,
        },
        {
            "id": 3,
            "name": "Ali Hassan",
            "religion": "Muslim",
            "gender": "Male",
            "couple_id": None,
        },
        {
            "id": 4,
            "name": "Rachel Green",
            "religion": "Jewish",
            "gender": "Female",
            "couple_id": 2,
        },
        {
            "id": 5,
            "name": "Ross Green",
            "religion": "Jewish",
            "gender": "Male",
            "couple_id": 2,
        },
        {
            "id": 6,
            "name": "Chandler Bing",
            "religion": "other",
            "gender": "Male",
            "couple_id": None,
        },
        {
            "id": 7,
            "name": "Monica",
            "religion": "Muslim",
            "gender": "Female",
            "couple_id": None,
        },
        {
            "id": 8,
            "name": "Joey",
            "religion": "Jewish",
            "gender": "Male",
            "couple_id": None,
        },
        {
            "id": 9,
            "name": "Phoebe",
            "religion": "Christian",
            "gender": "Female",
            "couple_id": None,
        },
        {
            "id": 10,
            "name": "Akshay",
            "religion": "Muslim",
            "gender": "Male",
            "couple_id": None,
        },
    ]

    gb = GroupBuilder(data, 4, 6)
    print(gb.generate_assignments())
