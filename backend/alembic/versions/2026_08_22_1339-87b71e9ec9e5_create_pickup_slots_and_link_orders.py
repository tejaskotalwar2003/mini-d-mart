"""create_pickup_slots_and_link_orders

Revision ID: 87b71e9ec9e5
Revises: 'f1eb55aa7814'
Create Date: 2026-08-22 13:39:54.806207

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '87b71e9ec9e5'
down_revision: Union[str, None] = 'f1eb55aa7814'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'pickup_slots',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('store_id', sa.UUID(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('end_time', sa.Time(), nullable=False),
        sa.Column('capacity', sa.Integer(), nullable=False),
        sa.Column('booked_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['store_id'], ['stores.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_pickup_slots_date'), 'pickup_slots', ['date'], unique=False)
    op.create_index(op.f('ix_pickup_slots_store_id'), 'pickup_slots', ['store_id'], unique=False)

    with op.batch_alter_table('orders', schema=None) as batch_op:
        batch_op.create_foreign_key('fk_orders_pickup_slot_id', 'pickup_slots', ['pickup_slot_id'], ['id'])


def downgrade() -> None:
    with op.batch_alter_table('orders', schema=None) as batch_op:
        batch_op.drop_constraint('fk_orders_pickup_slot_id', type_='foreignkey')

    op.drop_index(op.f('ix_pickup_slots_store_id'), table_name='pickup_slots')
    op.drop_index(op.f('ix_pickup_slots_date'), table_name='pickup_slots')
    op.drop_table('pickup_slots')
