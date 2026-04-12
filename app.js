document.addEventListener('DOMContentLoaded', function () {
    // Days of the week
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    // Initialize days checkboxes
    const daysCheckboxesContainer = document.getElementById('daysCheckboxes');
    daysOfWeek.forEach(day => {
        const div = document.createElement('div');
        div.className = 'day-checkbox';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `day-${day}`;
        checkbox.value = day;
        checkbox.checked = day !== 'Saturday' && day !== 'Sunday';

        const label = document.createElement('label');
        label.htmlFor = `day-${day}`;
        label.textContent = day;

        div.appendChild(checkbox);
        div.appendChild(label);
        daysCheckboxesContainer.appendChild(div);
    });

    // Populate day options in constraints
    const constraintDaySelects = document.querySelectorAll('.constraint-day');
    constraintDaySelects.forEach(select => {
        daysOfWeek.forEach(day => {
            const option = document.createElement('option');
            option.value = day;
            option.textContent = day;
            select.appendChild(option);
        });
    });

    // Add constraint functionality
    document.getElementById('addConstraint').addEventListener('click', addConstraint);

    // Calculate schedule when button is clicked
    document.getElementById('calculateSchedule').addEventListener('click', calculateSchedule);

    // Handle constraint type change
    document.addEventListener('change', function (e) {
        if (e.target.classList.contains('constraint-type')) {
            const constraintDiv = e.target.closest('.constraint');
            const timeInput = constraintDiv.querySelector('.constraint-time');
            const hoursInput = constraintDiv.querySelector('.constraint-hours');

            if (e.target.value === 'max') {
                timeInput.style.display = 'none';
                hoursInput.style.display = 'inline-block';
            } else {
                timeInput.style.display = 'inline-block';
                hoursInput.style.display = 'none';
            }
        }
    });

    // Handle remove constraint
    document.addEventListener('click', function (e) {
        if (e.target.classList.contains('remove-constraint')) {
            e.target.closest('.constraint').remove();
        }
    });

    function addConstraint() {
        const container = document.getElementById('constraints-container');
        const newConstraint = container.querySelector('.constraint').cloneNode(true);

        // Reset values
        newConstraint.querySelector('.constraint-day').value = '';
        newConstraint.querySelector('.constraint-type').value = 'until';
        newConstraint.querySelector('.constraint-time').value = '';
        newConstraint.querySelector('.constraint-hours').value = '';
        newConstraint.querySelector('.constraint-time').style.display = 'inline-block';
        newConstraint.querySelector('.constraint-hours').style.display = 'none';

        container.appendChild(newConstraint);
    }

    function calculateSchedule() {
        // Get user inputs
        const totalHours = parseFloat(document.getElementById('totalHours').value);
        const lunchBreak = parseFloat(document.getElementById('lunchBreak').value);
        const includeLunch = document.getElementById('includeLunch').checked;

        // Get selected days
        const selectedDays = [];
        document.querySelectorAll('#daysCheckboxes input[type="checkbox"]:checked').forEach(checkbox => {
            selectedDays.push(checkbox.value);
        });

        if (selectedDays.length === 0) {
            alert('Please select at least one available day.');
            return;
        }

        // Get constraints
        const constraints = [];
        document.querySelectorAll('.constraint').forEach(constraintDiv => {
            const day = constraintDiv.querySelector('.constraint-day').value;
            const type = constraintDiv.querySelector('.constraint-type').value;
            const time = constraintDiv.querySelector('.constraint-time').value;
            const hours = constraintDiv.querySelector('.constraint-hours').value;

            if (day) {
                constraints.push({
                    day: day,
                    type: type,
                    time: time,
                    hours: parseFloat(hours) || 0
                });
            }
        });

        // Calculate schedule
        const schedule = distributeHours(totalHours, selectedDays, constraints, lunchBreak, includeLunch);

        // Display schedule
        displaySchedule(schedule, lunchBreak, includeLunch);
    }

    function distributeHours(totalHours, selectedDays, constraints, lunchBreak, includeLunch) {
        // Start with equal distribution
        let hoursPerDay = totalHours / selectedDays.length;
        let schedule = {};

        // Initialize schedule with equal hours
        selectedDays.forEach(day => {
            schedule[day] = {
                hours: hoursPerDay,
                startTime: '09:00',
                endTime: calculateEndTime('09:00', hoursPerDay, lunchBreak, includeLunch)
            };
        });

        // Apply constraints
        constraints.forEach(constraint => {
            if (schedule[constraint.day]) {
                if (constraint.type === 'until') {
                    // Calculate hours based on end time
                    const startHour = 9; // Default start at 9 AM
                    const endHour = parseInt(constraint.time.split(':')[0]);
                    const endMinute = parseInt(constraint.time.split(':')[1]);

                    let availableHours = (endHour + endMinute / 60) - startHour;
                    if (includeLunch) {
                        availableHours -= lunchBreak;
                    }

                    schedule[constraint.day].hours = Math.max(0, Math.min(schedule[constraint.day].hours, availableHours));
                    schedule[constraint.day].endTime = constraint.time;

                } else if (constraint.type === 'from') {
                    // Calculate hours based on start time
                    const startHour = parseInt(constraint.time.split(':')[0]);
                    const startMinute = parseInt(constraint.time.split(':')[1]);
                    const endHour = 17; // Default end at 5 PM

                    let availableHours = endHour - (startHour + startMinute / 60);
                    if (includeLunch) {
                        availableHours -= lunchBreak;
                    }

                    schedule[constraint.day].hours = Math.max(0, Math.min(schedule[constraint.day].hours, availableHours));
                    schedule[constraint.day].startTime = constraint.time;

                } else if (constraint.type === 'max') {
                    // Apply maximum hours constraint
                    schedule[constraint.day].hours = Math.min(schedule[constraint.day].hours, constraint.hours);
                }

                // Recalculate end time based on new hours
                schedule[constraint.day].endTime = calculateEndTime(
                    schedule[constraint.day].startTime,
                    schedule[constraint.day].hours,
                    lunchBreak,
                    includeLunch
                );
            }
        });

        // Adjust hours to meet total (simple redistribution)
        const totalScheduledHours = Object.values(schedule).reduce((sum, day) => sum + day.hours, 0);
        const difference = totalHours - totalScheduledHours;

        if (difference > 0) {
            // Distribute remaining hours to days without max constraints
            const daysWithoutMaxConstraints = selectedDays.filter(day => {
                const constraint = constraints.find(c => c.day === day && c.type === 'max');
                return !constraint || schedule[day].hours < constraint.hours;
            });

            if (daysWithoutMaxConstraints.length > 0) {
                const hoursToAdd = difference / daysWithoutMaxConstraints.length;
                daysWithoutMaxConstraints.forEach(day => {
                    schedule[day].hours += hoursToAdd;
                    schedule[day].endTime = calculateEndTime(
                        schedule[day].startTime,
                        schedule[day].hours,
                        lunchBreak,
                        includeLunch
                    );
                });
            }
        }

        return schedule;
    }

    function calculateEndTime(startTime, hours, lunchBreak, includeLunch) {
        const [startHour, startMinute] = startTime.split(':').map(Number);
        let totalMinutes = startHour * 60 + startMinute;

        // Add working hours
        totalMinutes += hours * 60;

        // Add lunch break if not included in working hours
        if (!includeLunch) {
            totalMinutes += lunchBreak * 60;
        }

        // Convert back to time string
        const endHour = Math.floor(totalMinutes / 60);
        const endMinute = totalMinutes % 60;

        return `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
    }

    function displaySchedule(schedule, lunchBreak, includeLunch) {
        const container = document.getElementById('schedule-container');
        const summary = document.getElementById('summary');

        // Clear previous schedule
        container.innerHTML = '';
        summary.innerHTML = '';

        // Create visualization for each day
        daysOfWeek.forEach(day => {
            const daySchedule = schedule[day];
            const dayDiv = document.createElement('div');
            dayDiv.className = 'day-schedule';

            const dayName = document.createElement('div');
            dayName.className = 'day-name';
            dayName.textContent = day;
            dayDiv.appendChild(dayName);

            if (daySchedule) {
                // Create bar visualization
                const barContainer = document.createElement('div');
                barContainer.className = 'bar-container';

                const bar = document.createElement('div');
                bar.className = 'working-bar';
                bar.style.width = `${daySchedule.hours * 20}px`; // Scale for visualization
                bar.title = `${daySchedule.hours.toFixed(1)} hours (${daySchedule.startTime} - ${daySchedule.endTime})`;
                bar.textContent = `${daySchedule.hours.toFixed(1)}h`;

                barContainer.appendChild(bar);
                dayDiv.appendChild(barContainer);

                // Display time range
                const timeRange = document.createElement('div');
                timeRange.className = 'time-range';
                timeRange.textContent = `${daySchedule.startTime} - ${daySchedule.endTime}`;
                dayDiv.appendChild(timeRange);

                // Display lunch info if applicable
                if (lunchBreak > 0) {
                    const lunchInfo = document.createElement('div');
                    lunchInfo.className = 'lunch-info';
                    lunchInfo.textContent = includeLunch ?
                        `Includes ${lunchBreak}h lunch` :
                        `+ ${lunchBreak}h lunch`;
                    dayDiv.appendChild(lunchInfo);
                }
            } else {
                const notWorking = document.createElement('div');
                notWorking.className = 'not-working';
                notWorking.textContent = 'Not working';
                dayDiv.appendChild(notWorking);
            }

            container.appendChild(dayDiv);
        });

        // Calculate and display summary
        const totalHours = Object.values(schedule).reduce((sum, day) => sum + (day?.hours || 0), 0);
        const totalDays = Object.keys(schedule).length;
        const avgHours = totalDays > 0 ? totalHours / totalDays : 0;

        summary.innerHTML = `
            <h3>Summary</h3>
            <p>Total working hours: ${totalHours.toFixed(1)} hours</p>
            <p>Average per day: ${avgHours.toFixed(1)} hours</p>
            <p>Lunch break: ${lunchBreak} hours ${includeLunch ? '(included in working hours)' : '(additional to working hours)'}</p>
        `;
    }
});