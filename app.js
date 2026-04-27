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
        const startTime = document.getElementById('startTime').value;
        const maxHoursPerDay = parseFloat(document.getElementById('maxHoursPerDay').value);

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
        const schedule = distributeHours(totalHours, selectedDays, constraints, lunchBreak, includeLunch, startTime, maxHoursPerDay);

        // Display schedule
        displaySchedule(schedule, lunchBreak, includeLunch);
    }

    function distributeHours(totalHours, selectedDays, constraints, lunchBreak, includeLunch, defaultStartTime, maxHoursPerDay) {
        // Start with equal distribution
        let hoursPerDay = totalHours / selectedDays.length;
        let schedule = {};

        // Initialize schedule with equal hours (respecting max per day)
        selectedDays.forEach(day => {
            const initialHours = Math.min(hoursPerDay, maxHoursPerDay);
            schedule[day] = {
                hours: initialHours,
                startTime: defaultStartTime,
                endTime: calculateEndTime(defaultStartTime, initialHours, lunchBreak, includeLunch, maxHoursPerDay)
            };
        });

        // Apply constraints FIRST - this is crucial
        constraints.forEach(constraint => {
            if (schedule[constraint.day]) {
                if (constraint.type === 'until') {
                    // Calculate maximum hours available until constraint time
                    const startHour = parseInt(schedule[constraint.day].startTime.split(':')[0]);
                    const startMinute = parseInt(schedule[constraint.day].startTime.split(':')[1]);
                    const endHour = parseInt(constraint.time.split(':')[0]);
                    const endMinute = parseInt(constraint.time.split(':')[1]);

                    let availableHours = (endHour + endMinute / 60) - (startHour + startMinute / 60);
                    if (availableHours < 0) availableHours += 24; // Handle overnight

                    // Apply lunch break rule for continuous work (>= 6 hours)
                    if (availableHours >= 6 && !includeLunch && lunchBreak > 0) {
                        availableHours -= lunchBreak;
                    }

                    // Set hours to the minimum of current hours and available hours
                    schedule[constraint.day].hours = Math.min(
                        schedule[constraint.day].hours,
                        Math.min(availableHours, maxHoursPerDay)
                    );

                    // Force end time to be exactly the constraint time
                    schedule[constraint.day].endTime = constraint.time;

                } else if (constraint.type === 'from') {
                    // Update start time and recalculate hours
                    schedule[constraint.day].startTime = constraint.time;
                    // Hours will be adjusted in the redistribution phase

                } else if (constraint.type === 'max') {
                    // Apply maximum hours constraint
                    schedule[constraint.day].hours = Math.min(
                        schedule[constraint.day].hours,
                        Math.min(constraint.hours, maxHoursPerDay)
                    );
                }

                // Recalculate end time based on new hours (except for "until" constraints)
                if (constraint.type !== 'until') {
                    schedule[constraint.day].endTime = calculateEndTime(
                        schedule[constraint.day].startTime,
                        schedule[constraint.day].hours,
                        lunchBreak,
                        includeLunch,
                        maxHoursPerDay
                    );
                }
            }
        });

        // Now redistribute hours to meet total
        const totalScheduledHours = Object.values(schedule).reduce((sum, day) => sum + day.hours, 0);
        let difference = totalHours - totalScheduledHours;

        if (difference !== 0) {
            // Find days that can accept more hours
            const adjustableDays = selectedDays.filter(day => {
                const daySchedule = schedule[day];
                const constraint = constraints.find(c => c.day === day);

                // Check if day has constraints that limit hours
                if (constraint) {
                    if (constraint.type === 'until') {
                        // For "until" constraints, check if we're already at the limit
                        const startHour = parseInt(daySchedule.startTime.split(':')[0]);
                        const startMinute = parseInt(daySchedule.startTime.split(':')[1]);
                        const endHour = parseInt(daySchedule.endTime.split(':')[0]);
                        const endMinute = parseInt(daySchedule.endTime.split(':')[1]);

                        const currentHours = (endHour + endMinute / 60) - (startHour + startMinute / 60);
                        const maxPossible = Math.min(maxHoursPerDay, currentHours + (difference > 0 ? difference : 0));

                        return daySchedule.hours < maxPossible;
                    }
                    else if (constraint.type === 'max') {
                        return daySchedule.hours < Math.min(constraint.hours, maxHoursPerDay);
                    }
                }

                // No specific constraint, just check max per day
                return daySchedule.hours < maxHoursPerDay;
            });

            if (adjustableDays.length > 0) {
                const hoursPerAdjustableDay = difference / adjustableDays.length;

                adjustableDays.forEach(day => {
                    const daySchedule = schedule[day];
                    const constraint = constraints.find(c => c.day === day);
                    let maxIncrease = maxHoursPerDay - daySchedule.hours;

                    if (constraint?.type === 'max') {
                        maxIncrease = Math.min(constraint.hours, maxHoursPerDay) - daySchedule.hours;
                    }
                    else if (constraint?.type === 'until') {
                        // Calculate maximum possible hours for "until" constraint
                        const startHour = parseInt(daySchedule.startTime.split(':')[0]);
                        const startMinute = parseInt(daySchedule.startTime.split(':')[1]);
                        const endHour = parseInt(daySchedule.endTime.split(':')[0]);
                        const endMinute = parseInt(daySchedule.endTime.split(':')[1]);

                        const currentHours = (endHour + endMinute / 60) - (startHour + startMinute / 60);
                        maxIncrease = Math.min(maxHoursPerDay, currentHours + Math.abs(difference)) - daySchedule.hours;
                    }

                    const actualIncrease = Math.min(Math.abs(hoursPerAdjustableDay), maxIncrease) * Math.sign(difference);
                    daySchedule.hours += actualIncrease;

                    // Recalculate end time
                    if (constraint?.type !== 'until') {
                        daySchedule.endTime = calculateEndTime(
                            daySchedule.startTime,
                            daySchedule.hours,
                            lunchBreak,
                            includeLunch,
                            maxHoursPerDay
                        );
                    }
                });
            }
        }

        return schedule;
    }

    function calculateEndTime(startTime, hours, lunchBreak, includeLunch, maxHoursPerDay = 24) {
        const [startHour, startMinute] = startTime.split(':').map(Number);
        let totalMinutes = startHour * 60 + startMinute;

        // Add working hours (respect max per day)
        const actualHours = Math.min(hours, maxHoursPerDay);

        // Check if lunch break is required (>= 6 hours of continuous work)
        const requiresLunch = actualHours >= 6 && lunchBreak > 0;

        // Add working hours
        totalMinutes += actualHours * 60;

        // Add lunch break if required and not included in working hours
        if (requiresLunch && !includeLunch) {
            totalMinutes += lunchBreak * 60;
        }

        // Convert back to time string
        const endHour = Math.floor(totalMinutes / 60) % 24;
        const endMinute = totalMinutes % 60;

        return `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
    }

    function displaySchedule(schedule, lunchBreak, includeLunch) {
        const container = document.getElementById('schedule-container');
        const summary = document.getElementById('summary');
        const maxHoursPerDay = parseFloat(document.getElementById('maxHoursPerDay').value);

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
                const totalHours = daySchedule.hours;
                const hasLunch = lunchBreak > 0 && totalHours >= 6 && !includeLunch;

                // Calculate time at work (including lunch if applicable)
                const timeAtWork = totalHours + (hasLunch ? lunchBreak : 0);

                // Create bar container
                const barContainer = document.createElement('div');
                barContainer.className = 'bar-container';

                // Create working hours segment
                const workingBar = document.createElement('div');
                workingBar.className = 'working-bar';

                // Calculate widths based on maxHoursPerDay
                const workingWidth = (totalHours / maxHoursPerDay) * 100;
                const lunchWidth = hasLunch ? (lunchBreak / maxHoursPerDay) * 100 : 0;

                workingBar.style.width = `${workingWidth}%`;
                workingBar.title = `${totalHours.toFixed(1)} working hours (excluding lunch)`;
                workingBar.textContent = `${totalHours.toFixed(1)}h`;

                barContainer.appendChild(workingBar);

                // Add lunch break segment if applicable
                if (hasLunch) {
                    const lunchBar = document.createElement('div');
                    lunchBar.className = 'lunch-bar';
                    lunchBar.style.width = `${lunchWidth}%`;
                    lunchBar.title = `${lunchBreak}h lunch break`;
                    lunchBar.textContent = `+${lunchBreak}h`;
                    barContainer.appendChild(lunchBar);
                }

                // Add empty space to represent remaining capacity up to maxHoursPerDay
                const remainingHours = maxHoursPerDay - timeAtWork;
                if (remainingHours > 0) {
                    const emptyBar = document.createElement('div');
                    emptyBar.className = 'empty-bar';
                    emptyBar.style.width = `${(remainingHours / maxHoursPerDay) * 100}%`;
                    emptyBar.title = `${remainingHours.toFixed(1)}h available capacity`;
                    barContainer.appendChild(emptyBar);
                }

                dayDiv.appendChild(barContainer);

                // Display time range
                const timeRange = document.createElement('div');
                timeRange.className = 'time-range';
                timeRange.textContent = `${daySchedule.startTime} - ${daySchedule.endTime}`;
                dayDiv.appendChild(timeRange);

                // Display CLEAR time breakdown
                const timeBreakdown = document.createElement('div');
                timeBreakdown.className = 'time-breakdown';

                if (hasLunch) {
                    timeBreakdown.innerHTML = `
                        <strong>Time at work:</strong> ${timeAtWork.toFixed(1)}h (${totalHours.toFixed(1)}h work + ${lunchBreak}h lunch)<br>
                        <strong>Working hours:</strong> ${totalHours.toFixed(1)}h (excluding lunch)
                    `;
                } else if (includeLunch && lunchBreak > 0) {
                    timeBreakdown.innerHTML = `
                        <strong>Time at work:</strong> ${totalHours.toFixed(1)}h (includes ${lunchBreak}h lunch)<br>
                        <strong>Working hours:</strong> ${(totalHours - lunchBreak).toFixed(1)}h (excluding lunch)
                    `;
                } else {
                    timeBreakdown.innerHTML = `
                        <strong>Time at work:</strong> ${totalHours.toFixed(1)}h<br>
                        <strong>Working hours:</strong> ${totalHours.toFixed(1)}h (no lunch break)
                    `;
                }
                dayDiv.appendChild(timeBreakdown);

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

        // Calculate total time at work (including lunch breaks where applicable)
        let totalTimeAtWork = 0;
        Object.values(schedule).forEach(day => {
            if (day) {
                const hasLunch = lunchBreak > 0 && day.hours >= 6 && !includeLunch;
                totalTimeAtWork += day.hours + (hasLunch ? lunchBreak : 0);
            }
        });

        summary.innerHTML = `
            <h3>Summary</h3>
            <p><strong>Total time at work:</strong> ${totalTimeAtWork.toFixed(1)} hours (including lunch breaks where applicable)</p>
            <p><strong>Total working hours:</strong> ${totalHours.toFixed(1)} hours (excluding lunch breaks)</p>
            <p><strong>Average working hours per day:</strong> ${avgHours.toFixed(1)} hours</p>
            <p><strong>Maximum hours per day:</strong> ${maxHoursPerDay} hours</p>
            <p><strong>Lunch break policy:</strong> ${lunchBreak} hours ${includeLunch ? '(included in working hours)' : '(added separately for days with ≥6 hours continuous work)'}</p>
            <p class="bar-legend">Bar Legend: <span class="legend-working">Working hours</span> <span class="legend-lunch">Lunch break</span> <span class="legend-empty">Available capacity</span></p>
            <p class="note"><strong>Note:</strong> "Time at work" includes both working hours and lunch breaks. "Working hours" excludes lunch breaks.</p>
        `;
    }
});