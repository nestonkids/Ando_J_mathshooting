extends CharacterBody2D

const SPEED := 300.0
const JUMP_VELOCITY := -450.0
const GRAVITY := 1200.0


func _physics_process(delta: float) -> void:
	if not is_on_floor():
		velocity.y += GRAVITY * delta

	# 上矢印でジャンプ(地面にいる時のみ)
	if Input.is_action_just_pressed("ui_up") and is_on_floor():
		velocity.y = JUMP_VELOCITY

	# 左右矢印キーで左右移動
	var direction := Input.get_axis("ui_left", "ui_right")
	velocity.x = direction * SPEED

	move_and_slide()
