from collections import defaultdict
from math import ceil
from ortools.sat.python import cp_model

def assignments() -> None:
    print("Imported")

model = cp_model.CpModel()

# Data input
participants = [
    {'id': 1, 'name': 'John Doe', 'religion': 'Christian', 'gender': 'Male', 'couple_id': 1},
    {'id': 2, 'name': 'Jane Doe', 'religion': 'Christian', 'gender': 'Female', 'couple_id': 1},
    {'id': 3, 'name': 'Ali Hassan', 'religion': 'Muslim', 'gender': 'Male', 'couple_id': None},
    {'id': 4, 'name': 'Rachel Green', 'religion': 'Jewish', 'gender': 'Female', 'couple_id': 2},
    {'id': 5, 'name': 'Ross Green', 'religion': 'Jewish', 'gender': 'Male', 'couple_id': 2},
    {'id': 6, 'name': 'Chandler Bing', 'religion': 'other', 'gender': 'Male', 'couple_id': None},
    {'id': 7, 'name': 'Monica', 'religion': 'Muslim', 'gender': 'Female', 'couple_id': None},
    {'id': 8, 'name': 'Joey', 'religion': 'Jewish', 'gender': 'Male', 'couple_id': None},
    {'id': 9, 'name': 'Phoebe', 'religion': 'Christian', 'gender': 'Female', 'couple_id': None},
    {'id': 10, 'name': 'Akshay', 'religion': 'Muslim', 'gender': 'Male', 'couple_id': None},
]
religions = set([p['religion'] for p in participants])
genders = set([p['gender'] for p in participants])

sessions = range(6)
tables = range(4)
table_size = ceil(len(participants) / len(tables))

# Decision variables
# x[p,t,s] -> is [p]articipant sitting at [t]able in [s]ession
x = {}
for p in participants:
    for s in sessions:
        for t in tables:
            x[(p['id'],s,t)] = model.NewBoolVar(f"x_p{p['id']}_s{s}_t{t}")

# Constraint definitions
# Each participants sits at one table per session
for p in participants:
    for s in sessions:
        model.Add(
            sum(x[(p['id'],s,t)] for t in tables) == 1
        )

# All tables are within 1 participant of all other tables
max_participants = {}
min_participants = {}

for s in sessions:
    max_participants[s] = model.NewIntVar(0, len(participants), f'max_participants_s{s}')
    min_participants[s] = model.NewIntVar(0, len(participants), f'min_participants_s{s}')

    for t in tables:
        table_participant_count = sum(x[(p['id'], s, t)] for p in participants)
        model.Add(max_participants[s] >= table_participant_count)
        model.Add(min_participants[s] <= table_participant_count)

    model.Add(max_participants[s] - min_participants[s] <= 1)

def add_participant_attribute_distribution_constraint(attribute_name, attribute_set) -> None:
    max_participants_per_attribute = {}
    min_participants_per_attribute = {}

    for s in sessions:
        for attribute_value in attribute_set:
            max_participants_per_attribute[(s,attribute_value)] = model.NewIntVar(0, len(participants),
                f'max_participants_{attribute_name}_s{s}_{attribute_name[0]}{attribute_value}')
            min_participants_per_attribute[(s,attribute_value)] = model.NewIntVar(0, len(participants),
                f'min_participants_{attribute_name}_s{s}_{attribute_name[0]}{attribute_value}')

            for t in tables:
                table_participant_count_per_attribute = sum(
                    x[(p['id'], s, t)] for p in participants if p[attribute_name] == attribute_value
                )
                model.Add(max_participants_per_attribute[(s,attribute_value)] >= table_participant_count_per_attribute)
                model.Add(min_participants_per_attribute[(s,attribute_value)] <= table_participant_count_per_attribute)

            model.Add(max_participants_per_attribute[(s,attribute_value)] - min_participants_per_attribute[(s,attribute_value)] <= 1)

# No table has more than one participant from a religion than any other table
add_participant_attribute_distribution_constraint('religion', religions)
# No table has more than one participant from a religion than any other table
add_participant_attribute_distribution_constraint('gender', genders)

# Objective functions
# Separate couples as much as possible
objective_terms = []
couples = defaultdict(list)
for p in participants:
    if p['couple_id']:
        couples[p['couple_id']].append(p)
        

for s in sessions:
    for t in tables:
        for group in couples.values():
            model.Add(sum(x[(p['id'], s, t)] for p in group) <= 1)

# Distribute religions as much as possible
# ideal_religion_distribution = ceil(len(participants) / (len(religions) * len(tables)))
# deviations = {}
# objective_terms = []
# for s in sessions:
#     for t in tables:
#         for r in religions:
#             deviations[(r,s,t)] = model.NewIntVar(0, len(participants), f'deviation_r{r}_s{s}_t{t}')

#             actual_religion_distribution = sum(x[p['id'],s,t] for p in participants if p['religion'] == r)

#             model.Add(deviations[(r, s, t)] >= actual_religion_distribution - ideal_religion_distribution)
#             model.Add(deviations[(r, s, t)] >= ideal_religion_distribution - actual_religion_distribution)

#             objective_terms.append(deviations[(r, s,t)])
# model.Minimize(sum(objective_terms))

# Distribute participants as much as possible between sessions, with more emphasis on early sessions
weighted_actual_pairings = 0
for s in sessions:
    session_weight = len(sessions) - s
    for t in tables:
        for p1 in participants:
            for p2 in participants:
                if p2['id'] <= p1['id']:
                    continue
                z = model.NewBoolVar(f'pairing_p1{p1["id"]}_p2{p2["id"]}_s{s}_t{t}')
                model.Add(z <= x[(p1['id'], s, t)])
                model.Add(z <= x[(p2['id'], s, t)])
                model.Add(z >= x[(p1['id'], s, t)] + x[(p2['id'], s, t)] - 1)
                weighted_actual_pairings += session_weight * z
model.Minimize(weighted_actual_pairings)

# Run Solver
solver = cp_model.CpSolver()
status = solver.Solve(model)

if status in [cp_model.FEASIBLE, cp_model.OPTIMAL]:
    print(f'Solution found with total deviation: {solver.ObjectiveValue()}')
    for s in sessions:
        for t in tables:
            for p in participants:
                if solver.BooleanValue(x[(p['id'], s, t)]):
                    print(f"Participant {p['id']} {p['religion']} is at Table {t} in Session {s}.")
else:
    print('No solution')